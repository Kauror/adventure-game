# Stage 0A-1 deployment — `realm.orgusaar.ee`

Publishes the Stage 0A-1 prototype (roadmap task 0A.11) so the children can reach
it from their own phones. That is the entire purpose: Kid Test 0's real gate is
the **second sitting, days later, unprompted**, and it only works if the toy has
a URL they can open themselves.

## What this is not

Stage 0A is an offline browser toy (ADR 0004). This deployment contains **no**
game server, Colyseus, PostgreSQL, accounts, WebSockets, persistence or
multiplayer. The browser runs the whole game; KOCorp serves static files and
nothing else. All of that arrives at Stage 0B, under PLAN §22 — do not
pre-build any of it here.

## Architecture

```
phones/tablets
      │  HTTPS
      ▼
Cloudflare  ── realm.orgusaar.ee
      │
      ▼
Cloudflare Tunnel  "kocorp-harjutaja"  (existing, shared with three other apps)
      │  HTTP
      ▼
KOCorp  192.168.1.133:8091
      │
      ▼
adventure-web   nginx, static Vite/Babylon build, network adventure-net
```

### Two decisions worth knowing

**The existing tunnel is reused, not replaced.** `kocorp-harjutaja` already
publishes `harjutaja`, `fotod` and `male`. Adding a fourth published-application
route is additive and reversible; a second `cloudflared` container would be more
moving parts serving one static page.

**The origin is a host port, not a container name.** Container-to-container
routing (`http://adventure-web:8080`) would be tidier, but it requires attaching
the production `cloudflared` container to `adventure-net` — restructuring a
working tunnel that three other applications depend on, to save one port. Two of
that tunnel's three existing routes already point at `192.168.1.133:<port>`, so
a host port is both the safer change and the consistent one.

Port **8091** was chosen after checking that 8080, 8085, 8090 and 3000 were
already taken on the host. It is reachable on the LAN as well as through the
tunnel; that is acceptable because the container serves only the game's static
files and exposes no management interface.

## Identity

|                 |                                                             |
| --------------- | ----------------------------------------------------------- |
| Container       | `adventure-web`                                             |
| Image           | `adventure-web:<commit-sha>` — never `latest`               |
| Network         | `adventure-net` (dedicated)                                 |
| Host port       | `8091` → container `8080`                                   |
| Private origin  | `http://192.168.1.133:8091`                                 |
| Public hostname | `https://realm.orgusaar.ee`                                 |
| Tunnel          | `kocorp-harjutaja` (`f7c4ba64-00d8-4bca-a7f9-1ac1246b7915`) |
| Source on host  | `/mnt/user/appdata/adventure/src`                           |

## Build and deploy

Source reaches KOCorp as a tarball of the committed tree, because the repository
has no remote yet. From the repository root on the development machine:

```sh
git archive --format=tar HEAD \
  | ssh root@192.168.1.133 \
      'mkdir -p /mnt/user/appdata/adventure/src \
       && tar -x -C /mnt/user/appdata/adventure/src'
```

Then, on KOCorp:

```sh
cd /mnt/user/appdata/adventure/src
./deploy/stage0a/deploy.sh <commit-sha>
```

The SHA is required rather than derived: the tarball has no `.git`, and a
published build that cannot be traced back to a commit is not deployable. It
becomes both the image tag and the version marker the phone reports.

Once a git remote exists, replace the tarball step with a `git clone`/`git pull`
and let `deploy.sh` read the SHA itself.

### Cloudflare route

Added once, by hand, in the dashboard: **Networks → Tunnels & Mesh →
kocorp-harjutaja → Published application routes → Add**.

- Subdomain `realm`, domain `orgusaar.ee`, path empty
- Service `HTTP` → `192.168.1.133:8091`

Cloudflare creates the proxied `realm` DNS record itself. No Cloudflare Access
policy is attached: this URL has to open normally on a nine-year-old's phone.

## Verify

```sh
# on KOCorp
docker ps --filter name=adventure-web
curl -sI http://127.0.0.1:8091/            # 200, Cache-Control: no-cache
curl -sI http://127.0.0.1:8091/assets/…    # 200, immutable
docker logs --tail 50 adventure-web

# from anywhere
curl -sI https://realm.orgusaar.ee/
```

The published build identifies itself in two places, both hidden from children:

- the debug overlay's first row — four taps in the top-left corner, or
  `?debug=1`;
- a `console.info` at boot, visible in the in-page console (eruda), which works
  even when the game fails to render at all.

Both show `<sha> · <build time>Z`. A SHA suffixed `+dirty` means the image was
built from an uncommitted tree and is not traceable.

## Update

Re-run the two commands under **Build and deploy** with the new SHA. The new
image gets its own tag and `docker compose up -d` recreates only `adventure-web`.

## Rollback

Stage 0A holds no persistent state, so rollback is just the previous tag:

```sh
cd /mnt/user/appdata/adventure/src
docker images adventure-web                      # list the tags you have
ADVENTURE_IMAGE=adventure-web:<previous-sha> \
  docker compose -f deploy/stage0a/docker-compose.yml up -d
```

Keep the last known-good tag. `docker image rm adventure-web:<old-sha>` prunes
one image explicitly when the disk needs it — never `docker image prune`, which
would touch unrelated KOCorp services.

To remove the deployment entirely:

```sh
docker compose -f deploy/stage0a/docker-compose.yml down
```

That stops and removes only `adventure-web` and `adventure-net`, and deletes the
Cloudflare route's origin — remove the published application route in the
dashboard as well, or `realm.orgusaar.ee` will return a tunnel error.

## KOCorp safety

The container runs with no Docker socket, no host mounts, no privileged mode,
all capabilities dropped, `no-new-privileges`, a read-only root filesystem, and
a dedicated network. It cannot reach any other KOCorp service, and nothing it
serves is generated at runtime. This matches the isolation contract in PLAN §22,
which applies from Stage 0B — it costs nothing to honour it a stage early.
