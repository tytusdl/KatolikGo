/**
 * Client-side anti-cheat response-time validators.
 *
 * Backported from `katolikgo-server/src/services/anti-cheat.service.ts`.
 * This client has no equivalent today — the only signal it captures is
 * the final score, which is trivially spoofable. These helpers are
 * pure functions, so they can run on the device without any backend
 * round-trip.
 *
 * The thresholds below are calibrated from the doc; tighten them if
 * legitimate plays start tripping them.
 *
 * NOTE: a real anti-cheat deployment belongs in Firestore rules / Cloud
 * Functions — the client check is best-effort, noisy telemetry, and
 * easily bypassed by anyone willing to patch the JS bundle. Keep that
 * in mind before relying on this for anything punitive.
 */

export interface AntiCheatResult {
  ok: boolean;
  /**
   * Short, human-readable reason for `ok: false`. UI should keep this
   * generic ("Suspicious response pattern detected") in production to
   * avoid leaking the detection logic to cheaters.
   */
  reason?: string;
}

/**
 * Lower / upper bounds (milliseconds) on a *single* answer.
 *   - < 200ms is faster than humanly possible post-reading a question.
 *   - > 120s suggests the user backgrounded the app then returned.
 */
const MIN_RESPONSE_MS = 200;
const MAX_RESPONSE_MS = 120_000;

/**
 * Validate one answer's response time. Use this in
 * `handleAnswerSelect` (or equivalent) before mutating any score state.
 * The doc recommends this run regardless of outcome — wrong answers
 * can be just as informative for cheat detection as correct ones.
 */
export function validateResponseTime(
  responseTimeMs: number,
  now: number = Date.now()
): AntiCheatResult {
  if (!Number.isFinite(responseTimeMs) || responseTimeMs <= 0) {
    return { ok: false, reason: 'Invalid response time' };
  }
  // Sanity bound: a negative or absurdly large number relative to "now"
  // indicates a clock-skew issue or a tampered timestamp.
  if (responseTimeMs > now + 60_000) {
    return { ok: false, reason: 'Response time in the future' };
  }
  if (responseTimeMs < MIN_RESPONSE_MS) {
    return { ok: false, reason: `Response too fast (<${MIN_RESPONSE_MS}ms)` };
  }
  if (responseTimeMs > MAX_RESPONSE_MS) {
    return { ok: false, reason: `Response too slow (>${MAX_RESPONSE_MS}ms)` };
  }
  return { ok: true };
}

/**
 * Validate an *array* of per-answer response times (e.g. a full quiz
 * session) for suspiciously uniform timing. Human answer times have a
 * measurable standard deviation; bot scripts with constant `setTimeout`
 * pacing have near-zero std-dev.
 *
 * Pattern heuristic from the doc:
 *   stdDev < 50ms AND average < 1000ms → flagged as suspect.
 *
 * Threshold rationale: bot scripts typically answer in 100-300ms with
 * very low variance; even a fast human reader averages >1000ms with
 * 100ms+ variance due to question difficulty + fatigue.
 */
const PATTERN_STDDEV_MS = 50;
const PATTERN_AVG_MAX_MS = 1000;

export function validateAnswerPattern(
  responseTimesMs: readonly number[],
  perAnswer: AntiCheatResult[] = responseTimesMs.map((t) =>
    validateResponseTime(t)
  )
): AntiCheatResult {
  const valid = responseTimesMs.filter((t) => Number.isFinite(t) && t > 0);
  if (valid.length < 4) {
    // Not enough samples for a meaningful std-dev.
    return { ok: true };
  }
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance =
    valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  const stdDev = Math.sqrt(variance);

  // Any single per-answer fail short-circuits.
  if (perAnswer.some((r) => !r.ok)) {
    return { ok: false, reason: 'Out-of-bounds response time detected' };
  }
  if (stdDev < PATTERN_STDDEV_MS && mean < PATTERN_AVG_MAX_MS) {
    return {
      ok: false,
      reason: `Uniform fast timing (stdDev=${stdDev.toFixed(0)}ms, avg=${mean.toFixed(0)}ms)`,
    };
  }
  return { ok: true };
}

/**
 * Convenience: validate an entire session's per-answer timings in one
 * shot. Returns the per-answer checks plus a session-level pattern
 * check. Callers can `console.warn` the offending `reason` values
 * without surfacing them in the UI.
 */
export function validateSessionTimings(
  responseTimesMs: readonly number[]
): {
  perAnswer: AntiCheatResult[];
  pattern: AntiCheatResult;
} {
  const perAnswer = responseTimesMs.map((t) => validateResponseTime(t));
  const pattern = validateAnswerPattern(responseTimesMs, perAnswer);
  return { perAnswer, pattern };
}
