export { TILE_METRES, WORLD } from './world';

export type {
  Region,
  RegionObject,
  RegionObjectType,
  TerrainKind,
  TileCoord,
  TileType,
  WorldPoint,
} from './region/types';

export {
  clampMovement,
  elevationAtWorld,
  findObject,
  findObjects,
  isInsideGrid,
  isWalkableTile,
  isWalkableWorld,
  regionSizeMetres,
  spawnPoint,
  tileAt,
  tileCentreToWorld,
  traceMovement,
  worldToTile,
} from './region/grid';

export { parseRegion, RegionParseError } from './region/parseRegion';

export type { MoveDirection } from './movement';
export { MOVEMENT, isPlausibleDisplacement, stepMovement } from './movement';

export type { DodgePhase, DodgeState } from './dodge';
export {
  DODGE,
  advanceDodge,
  canDodge,
  createDodgeState,
  dodgeSpeed,
  isDodging,
  isInvulnerable,
  startDodge,
} from './dodge';

export type {
  AttackGrade,
  AttackKind,
  AttackPhase,
  AttackRelease,
  AttackState,
  AttackSwing,
  TimingBand,
  TimingBands,
} from './attack';
export {
  HAMMER,
  advanceAttack,
  beginCharge,
  canAttack,
  cancelCharge,
  chargeProgress,
  comboPower,
  createAttackState,
  gradeBonus,
  gradeFor,
  isCharging,
  isPastTapThreshold,
  releaseCharge,
  timingBands,
} from './attack';

export type { Health } from './combat';
export {
  angleDifference,
  applyDamage,
  createHealth,
  distanceBetween,
  headingTo,
  healthFraction,
  isDead,
  isWithinMeleeArc,
} from './combat';

export type { EnemyPhase, EnemyState, EnemyUpdate } from './enemy';
export {
  ENEMY,
  advanceEnemy,
  createEnemy,
  damageEnemy,
  isEnemyDead,
  isTelegraphing,
  respawnEnemy,
  windUpProgress,
} from './enemy';
