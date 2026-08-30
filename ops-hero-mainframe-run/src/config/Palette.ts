/**
 * Named colours sampled from GAMEPLAY_REFERENCE. See SPEC.md section 7.4 (palette discipline):
 * introducing a hue that appears on no source board is forbidden.
 *
 * PROVISIONAL: these are read from the rendered reference image, not sampled from the file, which
 * is not on disk yet. Re-sample exactly once assets/source/01_gameplay_reference.png exists.
 */
export const Palette = {
  /** Camera clear colour behind the sky layer, taken from the sky gradient's top. */
  SKY: 0x1e7fe0,
  HUD_PANEL: 0x0e1526,
  HUD_PANEL_DARK: 0x080d18,
  HUD_BORDER: 0x3fa08a,
  TEXT_PRIMARY: 0x7cff9e,
  TEXT_DIM: 0x4a8f68,
  TEXT_HEADING: 0x9fe8c4,
  ACCENT_GOLD: 0xf5c542,
  ACCENT_CYAN: 0x66f2ff,
  ACCENT_MAGENTA: 0xff6bd6,
  ALERT_RED: 0xe03c3c,
  WHITE: 0xffffff,
} as const;

/** Bright colours the protagonist cycles through while golden-aura invincible. */
export const INVINCIBILITY_TINTS: readonly number[] = [0xffe066, 0x66f2ff, 0xff6bd6, 0xffffff];

/**
 * Power-meter segment ramp, matching the colour-graded bar drawn in GAMEPLAY_REFERENCE.
 * Index 0 is the leftmost (first-to-empty) segment.
 */
export const POWER_METER_RAMP: readonly number[] = [
  0xe03c3c, 0xe86a2c, 0xf09a2c, 0xf5c542, 0xd8d84a, 0xa8d84a, 0x6cd06a, 0x4ac0a0, 0x4a9ad0,
  0x4a6ad0,
];
