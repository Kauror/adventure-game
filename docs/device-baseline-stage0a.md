# Device baseline — Stage 0A

Roadmap task **0A.12**. What the game actually costs on the phones it has to run
on, measured rather than assumed.

**Results are recorded at the bottom. Everything above is method.** Do not fill
in numbers that were not observed, and do not invent precision the measurement
does not have — the roadmap says so explicitly, and a made-up figure here would
be worse than an empty table, because budgets get set from it.

## Running it

```
https://realm.orgusaar.ee/?stress=1      normal load
https://realm.orgusaar.ee/?stress=2      about twice
https://realm.orgusaar.ee/?stress=3      about three times
```

Add `&shadows=1` for the shadows-on comparison, and `&fps=0` to remove the 30 fps
cap. The scene appears with a readout panel in the top-left; **photograph the
panel** — that is the most reliable way to get numbers off an iPhone, which
cannot be inspected from a Windows machine at all.

This is a synthetic measurement scene. No child ever sees it, the entities have
no AI or combat, and it is exempt from Stage 0A's one-character/one-enemy scope.
It is reached only through the query parameter and lives in its own chunk, so it
costs the game's bundle nothing.

### What is in it

| Ladder | Humanoids | Entities | Props |
| ------ | --------- | -------- | ----- |
| ×1     | 6         | 10       | 24    |
| ×2     | 12        | 20       | 48    |
| ×3     | 18        | 30       | 72    |

Plus the test arena's walls and platforms, a continuous particle burst, and the
real textures. Everything uses the **actual pipeline** — the same GLB loader and
fitting, the same orthographic camera, the same particle system, the same frame
cap. A scene built from different parts would measure a game nobody is shipping.

### Method

1. Open the ladder step you are measuring, in **landscape**.
2. Let it settle for ~30 seconds. Shader compilation and texture upload are not
   the steady state.
3. Press **Reset (measure from now)**.
4. Leave it running. For the thermal question, leave it for **30 minutes** and
   watch `drift`.
5. Photograph the panel at the end.

### Reading the panel

| Field          | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| **median fps** | How it normally runs, over the whole run since reset.                   |
| **recent fps** | The last ~10 seconds.                                                   |
| **drift**      | median − recent. **This is the thermal finding.** Growing = throttling. |
| **p95 ms**     | The slow tail. 95% of frames were at least this quick.                  |
| **worst ms**   | The single worst frame.                                                 |
| **spikes**     | Frames taking more than twice the median.                               |

A median is used rather than an average on purpose: one 400 ms hitch drags a
mean down and blames the device for a single stumble. The median says how it
normally runs; **spikes** says how often it does not. They answer different
questions and must not be blended.

## Devices

From PREP-03. Only the first is confirmed available.

| Device            | Role                                      | Available |
| ----------------- | ----------------------------------------- | --------- |
| iPhone 13 mini    | The weakest target; budgets are set by it | Yes       |
| An Android phone  | Friends' households are not all iOS       | Not yet   |
| Tablet            | Changes touch layout assumptions          | Not yet   |
| PC/laptop browser | Upper bound, not a target                 | Yes       |

## Results

> **Not yet measured.** The scene is built and deployed; the numbers require the
> phone. Fill each row in from an observed run, and leave anything not observed
> blank rather than estimated.

### iPhone 13 mini

| Ladder | Shadows | Cap | median fps | recent fps | drift | p95 ms | worst ms | spikes | run length |
| ------ | ------- | --- | ---------- | ---------- | ----- | ------ | -------- | ------ | ---------- |
| ×1     | off     | 30  |            |            |       |        |          |        |            |
| ×1     | on      | 30  |            |            |       |        |          |        |            |
| ×1     | off     | —   |            |            |       |        |          |        |            |
| ×2     | off     | 30  |            |            |       |        |          |        |            |
| ×3     | off     | 30  |            |            |       |        |          |        |            |

### Observations to record in words

The roadmap asks for these, and none of them is a number:

- **Thermal**, over ~30 minutes: does `drift` grow? Does the phone get hot? Does
  it recover after being left alone?
- **Low Power Mode**: does iOS halve the frame rate? Does the cap still hold?
- **Accidental browser gestures**: anything that zooms, scrolls, navigates back,
  or reveals Safari's chrome mid-play.
- **Landscape usability**: is anything under the notch, the home indicator, or a
  thumb?
- **Audio unlock and resume**: does sound start on the first touch, and come back
  after the phone locks? **Note the ring/silent switch position** — iOS routes
  WebAudio through a session the switch can mute.
- **Lock and return**: lock the phone mid-run, wait a minute, come back. Does it
  resume, and does the frame rate recover?
- **WebGL2**: confirm from the readout that WebGL2 is in use, not WebGL1.

## What this is not

WebGPU is not measured and is not a dependency (PLAN §26). No LOD, atlasing or
batching has been done — optimising before there are numbers is how a project
acquires optimisations it cannot justify. If a ladder step fails badly, that is
a finding, not a bug to fix on the spot.
