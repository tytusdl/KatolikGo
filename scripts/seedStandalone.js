/**
 * Standalone Quiz Seeding Script
 * Run with: node scripts/seedStandalone.js
 *
 * Uses Firebase REST API (no service account needed)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'katolikgo-mobile';
const API_KEY = 'AIzaSyCzq0iMJZUGjLrSGEnou66f7AA8jsBu2Jw';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Load questions
const questionsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'all_questions.json'), 'utf8')
);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function firestoreRequest(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${url}?key=${API_KEY}`;
    const data = body ? JSON.stringify(body) : null;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
      },
    };

    const req = https.request(fullUrl, options, (res) => {
      let result = '';
      res.on('data', chunk => result += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(result ? JSON.parse(result) : null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${result}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function deleteDocument(collection, docId) {
  try {
    await firestoreRequest('DELETE', `${BASE_URL}/${collection}/${docId}`);
  } catch (_) {
    // Ignore not found
  }
}

async function createDocument(collection, docId, data) {
  const fields = {};
  
  // Convert JS data to Firestore format
  function convertValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return val % 1 === 0 ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(convertValue) } };
    }
    if (typeof val === 'object') {
      const mapFields = {};
      for (const [k, v] of Object.entries(val)) {
        mapFields[k] = convertValue(v);
      }
      return { mapValue: { fields: mapFields } };
    }
    return { stringValue: String(val) };
  }

  for (const [key, value] of Object.entries(data)) {
    fields[key] = convertValue(value);
  }

  await firestoreRequest('PATCH', `${BASE_URL}/${collection}/${docId}`, { fields });
}

async function listDocuments(collection) {
  try {
    const result = await firestoreRequest('GET', `${BASE_URL}/${collection}`);
    return result.documents || [];
  } catch (_) {
    return [];
  }
}

async function main() {
  console.log('🚀 Starting standalone seed script...');
  console.log(`📊 Total questions in JSON: ${questionsData.length}`);
  
  const classicQuestions = questionsData.filter(q => q.gameMode === 'classic');
  const tekaGambarQuestions = questionsData.filter(q => q.gameMode === 'teka-gambar');
  
  console.log(`📚 Classic: ${classicQuestions.length}`);
  console.log(`🖼️  Teka Gambar: ${tekaGambarQuestions.length}`);
  
  // Group by level
  const byLevel = {};
  classicQuestions.forEach(q => {
    const lvl = q.level || 1;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    });
  });

  // Fill levels 1-100 with real or placeholder
  for (let lvl = 1; lvl <= 100; lvl++) {
    if (!byLevel[lvl]) {
      byLevel[lvl] = [{
        question: `Tahap ${lvl} - Soalan akan ditambah tidak lama lagi`,
        options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
        correctAnswer: 0,
        explanation: 'Soalan untuk tahap ini sedang dalam penyediaan.',
      }];
    }
  }

  // Delete existing quizzes
  console.log('\n🗑️  Clearing existing quizzes...');
  const existing = await listDocuments('quizzes');
  console.log(`   Found ${existing.length} existing documents`);
  
  for (const doc of existing) {
    const docId = doc.name.split('/').pop();
    await deleteDocument('quizzes', docId);
    process.stdout.write('.');
  }
  console.log(' Done!');

  // Seed classic quizzes
  console.log('\n📚 Seeding classic quizzes (100 levels)...');
  for (const [levelStr, questions] of Object.entries(byLevel)) {
    const level = parseInt(levelStr);
    const difficulty = level <= 33 ? 'easy' : level <= 66 ? 'medium' : 'hard';
    const category = level <= 33 ? 'old_testament' : level <= 66 ? 'new_testament' : 'ccc';
    
    try {
      await createDocument('quizzes', `level_${level}`, {
        level,
        category,
        difficulty,
        questions,
        passingScore: 80,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      if (level % 10 === 0 || level === 1) {
        console.log(`   ✓ Level ${level}: ${questions.length} questions`);
      }
    } catch (e) {
      console.error(`   ✗ Level ${level} failed: ${e.message}`);
    }
    
    // Small delay to avoid rate limiting
    if (level % 20 === 0) await sleep(500);
  }

  // Seed teka gambar
  console.log('\n🖼️  Seeding Teka Gambar quizzes (10 levels)...');
  const tgByLevel = {};
  tekaGambarQuestions.forEach((q, idx) => {
    const lvl = Math.floor(idx / 10) + 1;
    if (!tgByLevel[lvl]) tgByLevel[lvl] = [];
    tgByLevel[lvl].push({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    });
  });

  for (let lvl = 1; lvl <= 10; lvl++) {
    if (!tgByLevel[lvl]) {
      tgByLevel[lvl] = [{
        question: `Teka Gambar Tahap ${lvl} - Soalan akan ditambah`,
        options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
        correctAnswer: 0,
        explanation: 'Mod visual sedang dalam pembangunan.',
      }];
    }
    
    const difficulty = lvl <= 3 ? 'easy' : lvl <= 7 ? 'medium' : 'hard';
    
    try {
      await createDocument('quizzes', `teka_gambar_${lvl}`, {
        level: lvl,
        category: 'who_am_i',
        difficulty,
        questions: tgByLevel[lvl],
        passingScore: 70,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`   ✓ Teka Gambar Level ${lvl}: ${tgByLevel[lvl].length} questions`);
    } catch (e) {
      console.error(`   ✗ Teka Gambar Level ${lvl} failed: ${e.message}`);
    }
  }

  // Verify
  console.log('\n✅ Seeding complete!');
  const finalList = await listDocuments('quizzes');
  console.log(`📊 Total documents in Firebase: ${finalList.length}`);
  
  console.log('\n🎉 All done! Check Firebase Console to verify.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});