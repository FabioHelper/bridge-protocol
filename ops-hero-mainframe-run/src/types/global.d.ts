/** Readonly probe the Playwright smoke test reads. Never used by gameplay logic. */
interface OpsHeroProbe {
  scene: string;
  lives: number;
  errors: string[];
  playerX?: number;
  playerY?: number;
}

interface Window {
  __OPS_HERO__: OpsHeroProbe;
}
