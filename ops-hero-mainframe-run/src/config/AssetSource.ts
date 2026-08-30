/**
 * Resolves where a texture is loaded from, so the same code runs in two very different hosts.
 *
 * - Normal web build: textures are files under `public/assets/`, loaded by relative path.
 * - Claude artifact build: an artifact is ONE self-contained HTML page that cannot fetch local
 *   files, so `tools/build_artifact.mjs` inlines every texture as a base64 data URI and publishes
 *   them on `window.OPS_HERO_ASSETS` before the game boots.
 *
 * Scenes must call `resolveAssetUrl` instead of hardcoding a path. That single indirection is what
 * lets one codebase ship to both targets with no conditional logic anywhere else.
 */
import { ASSET_BASE_PATH } from './AssetKeys';

type InlineAssetTable = Readonly<Record<string, string>>;

declare global {
  interface Window {
    /** Present only in the artifact build: maps `hero.png` to a data: URI. */
    OPS_HERO_ASSETS?: InlineAssetTable;
  }
}

/** True when running as a single-file artifact with textures inlined. */
export function isInlineAssetBuild(): boolean {
  return typeof window !== 'undefined' && window.OPS_HERO_ASSETS !== undefined;
}

/**
 * @param filename Contract filename, e.g. `hero.png`. Never a full path.
 * @returns A data: URI in the artifact build, otherwise a path under public/assets/.
 */
export function resolveAssetUrl(filename: string): string {
  const inline = typeof window === 'undefined' ? undefined : window.OPS_HERO_ASSETS;
  return inline?.[filename] ?? `${ASSET_BASE_PATH}${filename}`;
}
