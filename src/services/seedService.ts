/**
 * Auto-seed quizzes to Firebase on app startup
 * Only runs if quizzes collection is empty
 */

import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import questionsData from '@/data/all_questions.json';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

/** Coerced seed-data shape — anything coming from `all_questions.json`
 *  is `unknown` until we confirm it has the fields we depend on. The
 *  field-by-field coercion in `normalizeClassicQuestion` +
 *  `normalizeTekaGambarQuestion` keeps a malformed import from crashing
 *  the seed (and thus bricking first-launch) with a confusing
 *  `Cannot read property 'question' of undefined`. Each malformed
 *  item is logged and skipped, never silently re-routed to level 1. */
interface SeedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  level?: unknown;
  gameMode?: unknown;
}

/** Returns true iff `value` is an integer in the [1, 100] range that
 *  we expect for a classic / teka-gambar level. The previous
 *  `q.level || 1` short-circuit quietly masked data-import errors
 *  by stuffing any malformed item into Level 1 — Level 1 had 95
 *  questions from valid data and then a handful of "extras" from
 *  the malformed ones, which would be invisible until the player
 *  noticed a duplicate or off-by-one question. Strict check here
 *  makes the malformed case a hard skip + logged warning. */
function isValidLevel(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 100
  );
}

/** Coerce a raw JSON row into a usable classic question. Returns
 *  `null` if the row is missing any required field or has invalid
 *  types — caller logs and skips. */
function normalizeClassicQuestion(
  q: unknown
): (SeedQuestion & { level: number }) | null {
  if (!q || typeof q !== 'object') return null;
  const row = q as Record<string, unknown>;
  if (
    typeof row.question !== 'string' ||
    !Array.isArray(row.options) ||
    typeof row.correctAnswer !== 'number' ||
    !Number.isFinite(row.correctAnswer) ||
    typeof row.explanation !== 'string' ||
    !isValidLevel(row.level)
  ) {
    return null;
  }
  if (row.options.length < 2) return null;
  // correctAnswer must index into options.
  if (
    row.correctAnswer < 0 ||
    row.correctAnswer >= row.options.length
  ) {
    return null;
  }
  return {
    question: row.question,
    options: row.options as string[],
    correctAnswer: Math.floor(row.correctAnswer),
    explanation: row.explanation,
    level: row.level,
  };
}

/** Same as above but for `teka-gambar` — `level` is computed from
 *  the question's index in the array (`Math.floor(idx / 10) + 1`),
 *  so the validator doesn't need to inspect `row.level`. */
function normalizeTekaGambarQuestion(
  q: unknown
): SeedQuestion | null {
  if (!q || typeof q !== 'object') return null;
  const row = q as Record<string, unknown>;
  if (
    typeof row.question !== 'string' ||
    !Array.isArray(row.options) ||
    typeof row.correctAnswer !== 'number' ||
    !Number.isFinite(row.correctAnswer) ||
    typeof row.explanation !== 'string'
  ) {
    return null;
  }
  if (row.options.length < 2) return null;
  if (
    row.correctAnswer < 0 ||
    row.correctAnswer >= row.options.length
  ) {
    return null;
  }
  return {
    question: row.question,
    options: row.options as string[],
    correctAnswer: Math.floor(row.correctAnswer),
    explanation: row.explanation,
  };
}

let seedingPromise: Promise<void> | null = null;

export async function seedQuizzesIfEmpty(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      // Defensive: if the bundled JSON import silently resolved to
      // an empty object (e.g. bundler glitch), `questionsData` is
      // not an array and `.filter` would throw.
      if (!Array.isArray(questionsData)) {
        console.error(
          '[Seed] questionsData is not an array — refusing to seed. ' +
            'Check that src/data/all_questions.json exists and is valid JSON.'
        );
        seedingPromise = null;
        return;
      }

      // Check if quizzes already exist
      const snapshot = await getDocs(collection(db, 'quizzes'));
      if (!snapshot.empty) {
        console.log(`[Seed] ${snapshot.size} quizzes already exist, skipping seed.`);
        return;
      }

      console.log('[Seed] Seeding quizzes to Firebase...');

      // Normalize + group by level. Counters track malformed rows so
      // the final log tells the dev whether the JSON import was clean.
      let malformedClassic = 0;
      let malformedTekaGambar = 0;
      const classicQuestions: { level: number; q: SeedQuestion }[] = [];
      const tekaGambarQuestions: SeedQuestion[] = [];
      for (const raw of questionsData) {
        const mode = (raw as SeedQuestion)?.gameMode;
        if (mode === 'classic') {
          const n = normalizeClassicQuestion(raw);
          if (!n) {
            malformedClassic++;
            continue;
          }
          classicQuestions.push({ level: n.level, q: n });
        } else if (mode === 'teka-gambar') {
          const n = normalizeTekaGambarQuestion(raw);
          if (!n) {
            malformedTekaGambar++;
            continue;
          }
          tekaGambarQuestions.push(n);
        }
      }
      console.log(
        `[Seed] Found ${classicQuestions.length} valid classic + ${tekaGambarQuestions.length} valid teka-gambar questions ` +
          `(skipped ${malformedClassic} malformed classic + ${malformedTekaGambar} malformed teka-gambar).`
      );

      // Group classic by level — use a Map (rather than Record) so a
      // numeric key never gets coerced-to-string; the previous Record
      // usage didn't break anything but Map is more honest about what
      // we want here.
      const byLevel = new Map<number, QuizQuestion[]>();
      for (const { level, q } of classicQuestions) {
        if (!byLevel.has(level)) byLevel.set(level, []);
        byLevel.get(level)!.push({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        });
      }

      // Fill any missing levels 1-100 with a placeholder.
      let placeholdersInserted = 0;
      for (let lvl = 1; lvl <= 100; lvl++) {
        if (!byLevel.has(lvl)) {
          byLevel.set(lvl, [
            {
              question: `Tahap ${lvl} - Soalan akan ditambah tidak lama lagi`,
              options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
              correctAnswer: 0,
              explanation: 'Soalan untuk tahap ini sedang dalam penyediaan.',
            },
          ]);
          placeholdersInserted++;
        }
      }

      // Seed classic quizzes - use batched writes for efficiency.
      // Firestore batch limit is 500 ops; we cap at 400 per commit
      // to leave room for any future safety margin.
      const { writeBatch } = await import('firebase/firestore');
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const [level, questions] of byLevel) {
        batch.set(doc(db, 'quizzes', `level_${level}`), {
          level,
          category: level <= 33 ? 'old_testament' : level <= 66 ? 'new_testament' : 'ccc',
          difficulty: level <= 33 ? 'easy' : level <= 66 ? 'medium' : 'hard',
          questions,
          passingScore: 80,
          // MS-epoch number for consistency with the rest of the
          // codebase (see `types/index.ts` timestamp policy).
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
      if (batchCount > 0) await batch.commit();

      // Seed teka gambar quizzes (group every 10). Like classic,
      // fill missing levels 1-10 with a placeholder so quizService
      // never sees an empty list.
      const tgByLevel = new Map<number, QuizQuestion[]>();
      tekaGambarQuestions.forEach((q, idx) => {
        const lvl = Math.floor(idx / 10) + 1;
        if (!tgByLevel.has(lvl)) tgByLevel.set(lvl, []);
        tgByLevel.get(lvl)!.push({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        });
      });
      let tgPlaceholders = 0;
      for (let lvl = 1; lvl <= 10; lvl++) {
        if (!tgByLevel.has(lvl)) {
          tgByLevel.set(lvl, [
            {
              question: `Teka Gambar Tahap ${lvl} - Soalan akan ditambah`,
              options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
              correctAnswer: 0,
              explanation: 'Mod visual sedang dalam pembangunan.',
            },
          ]);
          tgPlaceholders++;
        }
      }

      for (const [level, questions] of tgByLevel) {
        await setDoc(doc(db, 'quizzes', `teka_gambar_${level}`), {
          level,
          category: 'who_am_i',
          difficulty: level <= 3 ? 'easy' : level <= 7 ? 'medium' : 'hard',
          questions,
          passingScore: 70,
          // MS-epoch number for consistency with the rest of the
          // codebase (see `types/index.ts` timestamp policy).
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const realClassicCount = classicQuestions.length;
      const realTekaCount = tekaGambarQuestions.length;
      console.log(
        `[Seed] Done! 100 classic levels (${realClassicCount} real + ${placeholdersInserted} placeholder) ` +
          `+ 10 teka-gambar levels (${realTekaCount} real + ${tgPlaceholders} placeholder).`
      );
    } catch (error) {
      console.error('[Seed] Error seeding quizzes:', error);
      seedingPromise = null; // Allow retry
    }
  })();

  return seedingPromise;
}