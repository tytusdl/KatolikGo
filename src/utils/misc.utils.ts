/**
 * Generic array/number helpers. No app-domain coupling.
 *
 * Backported from the `katolikgo-server` design doc
 * (`src/utils/misc.utils.ts`) — the two helpers below were used
 * throughout that backend, and the same patterns keep showing up in
 * the client (e.g. `quiz/[level].tsx`'s 50/50 was using
 * `array.sort(() => Math.random() - 0.5)`, which is not a uniform
 * shuffle).
 */

/**
 * Fisher–Yates shuffle. Returns a new array; does not mutate the
 * input. Each permutation is equally likely — unlike the
 * `sort(() => Math.random() - 0.5)` trick, which biases toward short
 * arrays and certain distributions.
 */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Pick `count` random items from `array` without replacement. Returns
 * fewer items if the array is shorter than `count`.
 */
export function randomItems<T>(array: readonly T[], count: number): T[] {
  return shuffleArray(array).slice(0, Math.min(count, array.length));
}

/**
 * Clamp a number into [min, max]. NaN propagates through `Math.min`
 * so guard with a finite check at the call site if needed.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
