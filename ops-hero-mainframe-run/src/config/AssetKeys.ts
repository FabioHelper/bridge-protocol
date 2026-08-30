// GENERATED FILE -- do not edit by hand.
// Source: assets/config/asset-contract.json (v4)
// Regenerate with: npm run gen:keys
//
// Generating this file is what enforces two integrity constraints at once:
//   1. no duplicated asset keys (the generator hard-fails on a collision);
//   2. the code's frame dimensions can never drift from the contract the pipeline validates.

/** Every texture key in the game. Exactly one definition per asset. */
export const AssetKeys = {
  ALERT_BOT: 'alert-bot',
  ALERT_DRONE: 'alert-drone',
  BG_FAR_SKY: 'bg-far-sky',
  BG_MID_MOUNTAINS: 'bg-mid-mountains',
  BG_NEAR_DATACENTER: 'bg-near-datacenter',
  COMMAND_TOKEN: 'command-token',
  ENV_CABINET_DOUBLE: 'env-cabinet-double',
  ENV_CABINET: 'env-cabinet',
  ENV_CABLE_MODULE: 'env-cable-module',
  ENV_CHAIR: 'env-chair',
  ENV_DESK: 'env-desk',
  ENV_FREESTANDING_MONITOR: 'env-freestanding-monitor',
  ENV_KEYBOARD: 'env-keyboard',
  ENV_MACHINERY_MODULE: 'env-machinery-module',
  ENV_RACK_WIDE: 'env-rack-wide',
  ENV_RACK: 'env-rack',
  ENV_TAPE_DRIVE_DIALS: 'env-tape-drive-dials',
  ENV_TAPE_DRIVE: 'env-tape-drive',
  ENV_TERMINAL_MONITOR: 'env-terminal-monitor',
  ENV_VENT_GRILLE: 'env-vent-grille',
  ENV_WALL_MONITOR: 'env-wall-monitor',
  ENV_WARNING_BEACON_TALL: 'env-warning-beacon-tall',
  ENV_WARNING_BEACON: 'env-warning-beacon',
  GAMEPLAY_TILES: 'gameplay-tiles',
  HERO: 'hero',
  HUD_BOTTOM: 'hud-bottom',
  HUD_MINIMAP: 'hud-minimap',
  HUD_TOP: 'hud-top',
  HUD_VIEWDATA: 'hud-viewdata',
  IMPACT_BURST: 'impact-burst',
  INVINCIBILITY_AURA: 'invincibility-aura',
  INVINCIBILITY_PICKUP: 'invincibility-pickup',
  JOB_FAIL_BOT: 'job-fail-bot',
  OPERATIONS_TILES: 'operations-tiles',
  SPARKLE_0: 'sparkle-0',
  SPARKLE_1: 'sparkle-1',
  SPARKLE_2: 'sparkle-2',
  SPARKLE_3: 'sparkle-3',
  SPARKLE_4: 'sparkle-4',
  SPARKLE_5: 'sparkle-5',
  SPARKLE_6: 'sparkle-6',
  SPARKLE_7: 'sparkle-7',
  SPOOL_RUNAWAY: 'spool-runaway',
  STAR_0: 'star-0',
  STAR_1: 'star-1',
  STAR_2: 'star-2',
  STAR_3: 'star-3',
  STAR_4: 'star-4',
} as const;

export type AssetKey = (typeof AssetKeys)[keyof typeof AssetKeys];

/** A spritesheet: loaded with frame dimensions, and used to size a runtime placeholder. */
export interface SpritesheetEntry {
  readonly key: AssetKey;
  readonly path: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
}

/** A single image. Fallback dimensions size the runtime placeholder if the file fails to load. */
export interface ImageEntry {
  readonly key: AssetKey;
  readonly path: string;
  readonly fallbackWidth: number;
  readonly fallbackHeight: number;
}

export type ManifestEntry = SpritesheetEntry | ImageEntry;

export function isSpritesheet(entry: ManifestEntry): entry is SpritesheetEntry {
  return 'frameWidth' in entry;
}

/** Directory under public/ that PreloadScene prefixes to every path. */
export const ASSET_BASE_PATH = 'assets/';

/** Load descriptors for every contracted asset, so PreloadScene contains no literals. */
export const ASSET_MANIFEST: readonly ManifestEntry[] = [
  { key: AssetKeys.ALERT_BOT, path: 'alert-bot.png', frameWidth: 32, frameHeight: 32, frameCount: 4 },
  { key: AssetKeys.ALERT_DRONE, path: 'alert-drone.png', frameWidth: 32, frameHeight: 32, frameCount: 4 },
  { key: AssetKeys.BG_FAR_SKY, path: 'bg-far-sky.png', fallbackWidth: 480, fallbackHeight: 184 },
  { key: AssetKeys.BG_MID_MOUNTAINS, path: 'bg-mid-mountains.png', fallbackWidth: 480, fallbackHeight: 184 },
  { key: AssetKeys.BG_NEAR_DATACENTER, path: 'bg-near-datacenter.png', fallbackWidth: 480, fallbackHeight: 184 },
  { key: AssetKeys.COMMAND_TOKEN, path: 'command-token.png', frameWidth: 16, frameHeight: 16, frameCount: 4 },
  { key: AssetKeys.ENV_CABINET_DOUBLE, path: 'env-cabinet-double.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_CABINET, path: 'env-cabinet.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_CABLE_MODULE, path: 'env-cable-module.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_CHAIR, path: 'env-chair.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_DESK, path: 'env-desk.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_FREESTANDING_MONITOR, path: 'env-freestanding-monitor.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_KEYBOARD, path: 'env-keyboard.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_MACHINERY_MODULE, path: 'env-machinery-module.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_RACK_WIDE, path: 'env-rack-wide.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_RACK, path: 'env-rack.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_TAPE_DRIVE_DIALS, path: 'env-tape-drive-dials.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_TAPE_DRIVE, path: 'env-tape-drive.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_TERMINAL_MONITOR, path: 'env-terminal-monitor.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_VENT_GRILLE, path: 'env-vent-grille.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_WALL_MONITOR, path: 'env-wall-monitor.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_WARNING_BEACON_TALL, path: 'env-warning-beacon-tall.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.ENV_WARNING_BEACON, path: 'env-warning-beacon.png', fallbackWidth: 96, fallbackHeight: 96 },
  { key: AssetKeys.GAMEPLAY_TILES, path: 'gameplay-tiles.png', frameWidth: 16, frameHeight: 16, frameCount: 9 },
  { key: AssetKeys.HERO, path: 'hero.png', frameWidth: 32, frameHeight: 48, frameCount: 10 },
  { key: AssetKeys.HUD_BOTTOM, path: 'hud-bottom.png', fallbackWidth: 480, fallbackHeight: 47 },
  { key: AssetKeys.HUD_MINIMAP, path: 'hud-minimap.png', fallbackWidth: 92, fallbackHeight: 59 },
  { key: AssetKeys.HUD_TOP, path: 'hud-top.png', fallbackWidth: 480, fallbackHeight: 42 },
  { key: AssetKeys.HUD_VIEWDATA, path: 'hud-viewdata.png', fallbackWidth: 108, fallbackHeight: 59 },
  { key: AssetKeys.IMPACT_BURST, path: 'impact-burst.png', frameWidth: 32, frameHeight: 32, frameCount: 4 },
  { key: AssetKeys.INVINCIBILITY_AURA, path: 'invincibility-aura.png', frameWidth: 64, frameHeight: 64, frameCount: 7 },
  { key: AssetKeys.INVINCIBILITY_PICKUP, path: 'invincibility-pickup.png', frameWidth: 16, frameHeight: 16, frameCount: 4 },
  { key: AssetKeys.JOB_FAIL_BOT, path: 'job-fail-bot.png', frameWidth: 32, frameHeight: 32, frameCount: 4 },
  { key: AssetKeys.OPERATIONS_TILES, path: 'operations-tiles.png', frameWidth: 16, frameHeight: 16, frameCount: 12 },
  { key: AssetKeys.SPARKLE_0, path: 'sparkle-0.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.SPARKLE_1, path: 'sparkle-1.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.SPARKLE_2, path: 'sparkle-2.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.SPARKLE_3, path: 'sparkle-3.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.SPARKLE_4, path: 'sparkle-4.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.SPARKLE_5, path: 'sparkle-5.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.SPARKLE_6, path: 'sparkle-6.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.SPARKLE_7, path: 'sparkle-7.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.SPOOL_RUNAWAY, path: 'spool-runaway.png', frameWidth: 32, frameHeight: 32, frameCount: 4 },
  { key: AssetKeys.STAR_0, path: 'star-0.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.STAR_1, path: 'star-1.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.STAR_2, path: 'star-2.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.STAR_3, path: 'star-3.png', fallbackWidth: 12, fallbackHeight: 12 },
  { key: AssetKeys.STAR_4, path: 'star-4.png', fallbackWidth: 12, fallbackHeight: 12 },
];
