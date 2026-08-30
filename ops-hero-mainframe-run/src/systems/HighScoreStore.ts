/**
 * High-score persistence behind an injectable storage interface, so unit tests use a fake and
 * production code uses `window.localStorage`. A corrupt or missing stored value degrades to 0
 * rather than throwing. See GAMEPLAY_SPEC.md section 8 and SPEC.md section 5.3.
 */
import { STORAGE } from '../config/Tuning';

/** The subset of the DOM `Storage` interface this store needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class HighScoreStore {
  constructor(
    private readonly storage: StorageLike,
    private readonly key: string = STORAGE.HIGH_SCORE_KEY,
  ) {}

  public read(): number {
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      return 0;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  /** Writes only if higher than the stored value. Returns the resulting (possibly unchanged) high score. */
  public commit(candidateScore: number): number {
    const current = this.read();
    if (candidateScore <= current) {
      return current;
    }
    this.storage.setItem(this.key, String(candidateScore));
    return candidateScore;
  }
}
