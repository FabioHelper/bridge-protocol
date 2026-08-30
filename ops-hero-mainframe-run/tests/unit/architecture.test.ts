import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

function filesUnder(dir: string): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : full.endsWith('.ts') ? [full] : [];
  });
}

describe('architecture rules', () => {
  it('keeps systems/ and level/ free of Phaser imports', () => {
    // This rule is load-bearing: it is what lets score, mission, invincibility and level geometry
    // be unit-tested in plain Node with no canvas and no mocking.
    const offenders = ['systems', 'level']
      .flatMap((dir) => filesUnder(join(SRC, dir)))
      .filter((file) => /from\s+['"]phaser['"]/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('forbids the any type across src/', () => {
    const offenders = filesUnder(SRC).filter((file) =>
      /:\s*any\b|<any>|as\s+any\b/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('confines pixelArt and roundPixels configuration to GameConfig.ts', () => {
    const offenders = filesUnder(SRC).filter(
      (file) =>
        !file.endsWith('GameConfig.ts') && /\b(pixelArt|roundPixels)\s*:/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
