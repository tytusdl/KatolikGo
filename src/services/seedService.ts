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

let seedingPromise: Promise<void> | null = null;

export async function seedQuizzesIfEmpty(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      // Check if quizzes already exist
      const snapshot = await getDocs(collection(db, 'quizzes'));
      if (!snapshot.empty) {
        console.log(`[Seed] ${snapshot.size} quizzes already exist, skipping seed.`);
        return;
      }

      console.log('[Seed] Seeding quizzes to Firebase...');

      // Group questions by level for classic mode
      const classicQuestions = questionsData.filter(
        (q: any) => q.gameMode === 'classic'
      );
      const tekaGambarQuestions = questionsData.filter(
        (q: any) => q.gameMode === 'teka-gambar'
      );
      console.log(`[Seed] Found ${classicQuestions.length} classic + ${tekaGambarQuestions.length} teka gambar questions`);

      // Group classic by level - ALL questions go to their respective level
      const byLevel: Record<number, QuizQuestion[]> = {};
      classicQuestions.forEach((q: any) => {
        const lvl = q.level || 1;
        if (!byLevel[lvl]) byLevel[lvl] = [];
        byLevel[lvl].push({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        });
      });

      // Ensure levels 1-100 all exist (fill empty ones with placeholder)
      for (let lvl = 1; lvl <= 100; lvl++) {
        if (!byLevel[lvl]) {
          byLevel[lvl] = [
            {
              question: `Tahap ${lvl} - Soalan akan ditambah tidak lama lagi`,
              options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
              correctAnswer: 0,
              explanation: 'Soalan untuk tahap ini sedang dalam penyediaan.',
            },
          ];
        }
      }

      // Seed classic quizzes - use batched writes for efficiency
      const { writeBatch } = await import('firebase/firestore');
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const [levelStr, questions] of Object.entries(byLevel)) {
        const level = parseInt(levelStr);
        batch.set(doc(db, 'quizzes', `level_${level}`), {
          level,
          category: level <= 33 ? 'old_testament' : level <= 66 ? 'new_testament' : 'ccc',
          difficulty: level <= 33 ? 'easy' : level <= 66 ? 'medium' : 'hard',
          questions,
          passingScore: 80,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        batchCount++;
        
        // Firestore batch limit is 500
        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
      if (batchCount > 0) await batch.commit();

      // Seed teka gambar quizzes (group every 10)
      const tgByLevel: Record<number, QuizQuestion[]> = {};
      tekaGambarQuestions.forEach((q: any, idx: number) => {
        const lvl = Math.floor(idx / 10) + 1;
        if (!tgByLevel[lvl]) tgByLevel[lvl] = [];
        tgByLevel[lvl].push({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        });
      });

      // Ensure Teka Gambar levels 1-10
      for (let lvl = 1; lvl <= 10; lvl++) {
        if (!tgByLevel[lvl]) {
          tgByLevel[lvl] = [
            {
              question: `Teka Gambar Tahap ${lvl} - Soalan akan ditambah`,
              options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
              correctAnswer: 0,
              explanation: 'Mod visual sedang dalam pembangunan.',
            },
          ];
        }
      }

      for (const [levelStr, questions] of Object.entries(tgByLevel)) {
        const level = parseInt(levelStr);
        await setDoc(doc(db, 'quizzes', `teka_gambar_${level}`), {
          level,
          category: 'who_am_i',
          difficulty: level <= 3 ? 'easy' : level <= 7 ? 'medium' : 'hard',
          questions,
          passingScore: 70,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      console.log(
        `[Seed] Done! Seeded 100 classic levels (with ${classicQuestions.length} real questions + ${100 - Object.keys(byLevel).filter(k => parseInt(k) <= 50).length} placeholders) + 10 teka gambar levels.`
      );
    } catch (error) {
      console.error('[Seed] Error seeding quizzes:', error);
      seedingPromise = null; // Allow retry
    }
  })();

  return seedingPromise;
}