import { describe, expect, it } from 'vitest';

import {
  DODGE,
  ENEMY,
  HAMMER,
  MOVEMENT,
  advanceAttack,
  advanceDodge,
  advanceEnemy,
  applyDamage,
  beginCharge,
  canAttack,
  createAttackState,
  createDodgeState,
  createEnemy,
  createHealth,
  damageEnemy,
  distanceBetween,
  headingTo,
  isDodging,
  isInvulnerable,
  isTelegraphing,
  isWithinMeleeArc,
  parseRegion,
  releaseCharge,
  startDodge,
  stepMovement,
  type EnemyState,
  type Health,
  type WorldPoint,
} from '../src/index';

/**
 * An open arena, sized like the real test region rather than the tiny 6x4
 * fixture. Room matters here: a dodge defends by *moving you*, so a fight run
 * in a cramped box tests walls rather than dodging.
 */
function openArena(): Record<string, unknown> {
  const width = 14;
  const height = 12;
  const rows: string[] = [];
  for (let row = 0; row < height; row += 1) {
    rows.push(row === 0 || row === height - 1 ? '#'.repeat(width) : `#${'.'.repeat(width - 2)}#`);
  }

  return {
    schemaVersion: 1,
    id: 'fight-arena',
    nameKey: 'region.fightArena.name',
    legend: {
      '#': { walkable: false, elevation: 0, terrain: 'wall' },
      '.': { walkable: true, elevation: 0, terrain: 'floor' },
    },
    rows,
    objects: [{ type: 'player-spawn', id: 'spawn-player', tile: { col: 7, row: 6 } }],
  };
}

/**
 * The whole point of 0A.8, checked end to end.
 *
 * The roadmap's acceptance for the enemy is that a specific loop *emerges*:
 *
 *     read the wind-up -> dodge -> counterattack -> time the hammer
 *
 * These tests play that loop out against the real rules — no Babylon, no
 * rendering, just the simulation both the client and the future server run.
 * They are the deterministic half of "does the fight work"; whether it *feels*
 * right is a question only a child on a phone can answer.
 */

const region = parseRegion(openArena());
const STEP = 1 / 60;

interface Fighter {
  position: WorldPoint;
  facing: number;
  health: Health;
  dodge: ReturnType<typeof createDodgeState>;
  attack: ReturnType<typeof createAttackState>;
}

function createFighter(position: WorldPoint): Fighter {
  return {
    position,
    facing: 0,
    health: createHealth(5),
    dodge: createDodgeState(),
    attack: createAttackState(),
  };
}

interface FightResult {
  readonly enemy: EnemyState;
  readonly player: Fighter;
  readonly hitsTaken: number;
  readonly dodgesMade: number;
  readonly swingsLanded: number;
}

/**
 * Runs a fight where the player follows one simple policy:
 *
 *   - dodge the moment the enemy telegraphs;
 *   - otherwise charge the hammer and release it on the sweet spot.
 *
 * Deliberately naive — if a rule this simple can win without being hit, a child
 * playing by the same instinct can too.
 *
 * `dodgeSideways` picks *which* naive instinct. Sidestepping is the intended
 * counter, because the enemy locks its facing when it commits. Retreating looks
 * equally sensible to a child and is the one that fails: it walks you backwards
 * into a wall within a couple of dodges, and then the dodge stops moving you at
 * all. Both are worth having tests for.
 */
function fight(
  seconds: number,
  {
    dodgeWhenTelegraphed = true,
    counterattack = true,
    dodgeSideways = true,
    playerAt = { x: 7.5, z: 6.5 },
    enemyAt = { x: 9.4, z: 6.5 },
  }: {
    dodgeWhenTelegraphed?: boolean;
    counterattack?: boolean;
    dodgeSideways?: boolean;
    playerAt?: WorldPoint;
    enemyAt?: WorldPoint;
  } = {},
): FightResult {
  const player = createFighter(playerAt);
  let enemy = createEnemy(enemyAt);

  let hitsTaken = 0;
  let dodgesMade = 0;
  let swingsLanded = 0;
  let chargeHeld = 0;

  const perfectCharge = HAMMER.chargeSeconds * HAMMER.perfectCentreFraction;

  for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
    player.dodge = advanceDodge(player.dodge, STEP);
    player.attack = advanceAttack(player.attack, STEP);

    // Always face the enemy: aiming is not what this test is about.
    player.facing = headingTo(player.position, enemy.position);

    // React to the telegraph.
    if (dodgeWhenTelegraphed && isTelegraphing(enemy) && !isDodging(player.dodge)) {
      const escape = dodgeSideways
        ? // Perpendicular to the enemy: steps out of the arc it has committed to,
          // and keeps the player in the arena rather than backing into a wall.
          { x: Math.cos(player.facing), y: -Math.sin(player.facing) }
        : { x: -Math.sin(player.facing), y: -Math.cos(player.facing) };
      const started = startDodge(player.dodge, escape);
      if (started !== player.dodge) {
        dodgesMade += 1;
        player.dodge = started;
        // Committing to a dodge abandons any wind-up, as in the client.
        player.attack = createAttackState();
        chargeHeld = 0;
      }
    }

    // Close the distance when out of reach, the way a player naturally would —
    // a sidestep leaves you beside the enemy, not next to it.
    if (
      !isDodging(player.dodge) &&
      !isTelegraphing(enemy) &&
      enemy.phase !== 'dead' &&
      distanceBetween(player.position, enemy.position) > HAMMER.reachMetres * 0.7
    ) {
      player.position = stepMovement(
        region,
        player.position,
        { x: Math.sin(player.facing), y: Math.cos(player.facing) },
        STEP,
        MOVEMENT.maxSpeedMetresPerSecond,
      );
    }

    // Counterattack while it is helpless.
    if (counterattack && !isDodging(player.dodge)) {
      const inReach =
        distanceBetween(player.position, enemy.position) <= HAMMER.reachMetres &&
        enemy.phase !== 'dead';

      if (canAttack(player.attack) && inReach && !isTelegraphing(enemy)) {
        player.attack = beginCharge(player.attack);
        chargeHeld = 0;
      } else if (player.attack.phase === 'charging') {
        chargeHeld += STEP;
        if (chargeHeld >= perfectCharge) {
          const released = releaseCharge(player.attack, false);
          player.attack = released.state;
          chargeHeld = 0;

          if (
            released.swing !== null &&
            enemy.phase !== 'dead' &&
            isWithinMeleeArc(
              player.position,
              player.facing,
              enemy.position,
              HAMMER.reachMetres,
              HAMMER.swingHalfAngleRadians,
            )
          ) {
            enemy = damageEnemy(enemy, HAMMER.baseDamage * released.swing.power);
            swingsLanded += 1;
          }
        }
      }
    }

    if (isDodging(player.dodge)) {
      player.position = stepMovement(
        region,
        player.position,
        player.dodge.direction,
        STEP,
        DODGE.distanceMetres / DODGE.durationSeconds,
      );
    }

    const update = advanceEnemy(enemy, region, player.position, STEP);
    enemy = update.state;

    if (update.strikeLanded && !isInvulnerable(player.dodge)) {
      player.health = applyDamage(player.health, ENEMY.damage);
      hitsTaken += 1;
    }
  }

  return { enemy, player, hitsTaken, dodgesMade, swingsLanded };
}

describe('the intended loop emerges', () => {
  it('a player who reads the telegraph and dodges is never hit', () => {
    const result = fight(20);

    expect(result.dodgesMade).toBeGreaterThan(0);
    expect(result.hitsTaken).toBe(0);
    expect(result.player.health.current).toBe(result.player.health.max);
  });

  it('dodging then counterattacking kills the enemy', () => {
    const result = fight(20);

    expect(result.swingsLanded).toBeGreaterThan(0);
    expect(result.enemy.phase).toBe('dead');
    expect(result.enemy.health.current).toBe(0);
  });

  it('punishes a player who never dodges, so the mechanic matters', () => {
    const passive = fight(12, { dodgeWhenTelegraphed: false, counterattack: false });

    expect(passive.hitsTaken).toBeGreaterThan(0);
    expect(passive.player.health.current).toBeLessThan(passive.player.health.max);
  });

  it('does not let a player win by standing still and swinging', () => {
    // No dodging, only attacking: they should trade damage rather than walk it.
    const trading = fight(12, { dodgeWhenTelegraphed: false });
    expect(trading.hitsTaken).toBeGreaterThan(0);
  });

  it('kills the enemy in a handful of counterattacks, not dozens', () => {
    const result = fight(20);

    expect(result.swingsLanded).toBeGreaterThanOrEqual(2);
    expect(result.swingsLanded).toBeLessThanOrEqual(8);
  });

  it('keeps the enemy in reach, so the fight does not degenerate into a chase', () => {
    const result = fight(20);
    expect(distanceBetween(result.player.position, result.enemy.position)).toBeLessThan(
      ENEMY.aggroRangeMetres,
    );
  });
});

describe('what the dodge actually defends with', () => {
  it('cannot rely on invulnerability alone: i-frames are far shorter than a wind-up', () => {
    // This is the reason a dodge has to *move* you. Dodging the instant the
    // telegraph appears leaves the invulnerability long expired by the time the
    // blow actually lands.
    expect(DODGE.invulnerableSeconds).toBeLessThan(ENEMY.windUpSeconds);
  });

  it('saves a player who sidesteps, because the enemy has committed its facing', () => {
    expect(fight(20).hitsTaken).toBe(0);
  });

  it('does not protect a player whose dodge is blocked by a wall', () => {
    // The sharp edge, tested directly rather than through a whole fight: a dodge
    // defends by *displacing* you, so a dodge into a wall defends with nothing,
    // and its invulnerability is long gone by the time the blow lands.
    //
    // Positionally fair, but a five-year-old ends up in corners constantly.
    // Recorded rather than quietly accepted — a Kid Test 0 question.
    const againstWall: WorldPoint = { x: 1.4, z: 6.5 };
    let dodge = startDodge(createDodgeState(), { x: -1, y: 0 }); // straight into the wall
    let position = againstWall;
    let enemy = createEnemy({ x: 3.05, z: 6.5 });
    let struck = false;
    let protectedAtStrike = true;

    for (let elapsed = 0; elapsed < ENEMY.windUpSeconds + 0.5; elapsed += STEP) {
      dodge = advanceDodge(dodge, STEP);
      if (isDodging(dodge)) {
        position = stepMovement(
          region,
          position,
          dodge.direction,
          STEP,
          DODGE.distanceMetres / DODGE.durationSeconds,
        );
      }

      const update = advanceEnemy(enemy, region, position, STEP);
      enemy = update.state;
      if (update.strikeLanded) {
        struck = true;
        protectedAtStrike = isInvulnerable(dodge);
      }
    }

    // The dodge moved the player essentially nowhere...
    expect(Math.abs(position.x - againstWall.x)).toBeLessThan(0.5);
    // ...so the blow connects, with the invulnerability already expired.
    expect(struck).toBe(true);
    expect(protectedAtStrike).toBe(false);
  });
});
