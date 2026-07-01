/**
 * Firebase Quiz Seeding Script
 * Run: node scripts/seedQuestions.js
 * 
 * Prerequisites:
 * 1. npm install firebase-admin --save-dev
 * 2. Download service account key from Firebase Console
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS env var
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
} catch (e) {
  console.log('Using service account file...');
  const serviceAccountData = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountData),
  });
}

const db = admin.firestore();

// Load questions
const questionsData = require('../src/data/questions_backup.json');

async function seedQuestions() {
  console.log('Starting quiz seeding...');
  console.log(`Total questions to import: ${questionsData.length}`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const question of questionsData) {
    const quizId = `quiz_level_${question.level}`;
    const questionRef = db.collection('quizzes').doc(quizId);
    const questionData = {
      level: question.level,
      difficulty: question.difficulty,
      category: question.category || 'old_testament',
      questions: admin.firestore.FieldValue.arrayUnion({
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Use set with merge to create or update
    const docRef = db.collection('quizzes').doc(quizId);
    batch.set(docRef, {
      level: question.level,
      difficulty: question.difficulty,
      category: question.category || 'old_testament',
      questions: [{
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      }],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    
    count++;
    
    // Commit batch every 100 questions
    if (count % 100 === 0) {
      await batch.commit();
      console.log(`Committed ${count} questions...`);
      // Create new batch
      const newBatch = db.batch();
    }
  }
  
  // Commit remaining
  await batch.commit();
  console.log(`\n✅ Successfully imported ${count} questions!`);
  
  // Verify
  const snapshot = await db.collection('quizzes').get();
  console.log(`Total quiz documents in Firestore: ${snapshot.size}`);
  
  process.exit(0);
}

seedQuestions().catch((error) => {
  console.error('Error seeding questions:', error);
  process.exit(1);
});
