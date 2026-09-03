/**
 * Estonian is the canonical authoring locale (PLAN §20).
 *
 * Every player-visible string in the game lives here and is referenced by key.
 * Never inline a display string in a component — see CLAUDE.md.
 */
export const et = {
  'app.title': 'Seiklusmäng',

  'dev.stageLabel': 'Etapp 0A-1 · ülesanne 0A.11',
  // Deliberate Estonian character probe: proves the whole chain (source file ->
  // bundle -> DOM -> font) is UTF-8 clean. Asserted in tests/i18n.test.ts.
  'dev.charsetProbe': 'õ ä ö ü Õ Ä Ö Ü',

  // Deliberately two words: the diagram above it does the explaining, and most
  // of the players cannot read yet.
  'orientation.rotateToLandscape': 'Pööra seadet',

  'region.testArena.name': 'Prooviareen',

  // Development-only coordinate readout. Not player-facing, but it still goes
  // through the catalogue so the convention holds everywhere without exception.
  'debug.region': 'Ala',
  'debug.grid': 'Ruudustik',
  'debug.position': 'Asukoht',
  'debug.tile': 'Ruut',
  'debug.elevation': 'Kõrgus',
  'debug.walkable': 'Käidav',
  'debug.yes': 'jah',
  'debug.no': 'ei',
  'debug.moveHint': 'Liiguta vasaku pöidlaga, klaviatuuriga või puldiga',
  'debug.input': 'Sisend',
  'debug.gamepad': 'Pult',
  'debug.dodge': 'Põige',
  'debug.charge': 'Laeng',
  'debug.grade': 'Löök',
  'debug.combo': 'Seeria',
  'debug.enemy': 'Vaenlane',
  'debug.health': 'Elu',
  'debug.assist': 'Abi',
  'debug.fps': 'FPS',
  'debug.viewport': 'Vaade',
  'debug.camera': 'Kaamera',
  'debug.console': 'Ava konsool',
  // Which build this phone actually loaded. See config/buildInfo.ts.
  'debug.build': 'Versioon',
  'debug.audio': 'Heli',
  'debug.assistToggle': 'Lülita abi',

  'action.dodge': 'Põige',
  'action.attack': 'Löök',
} as const;
