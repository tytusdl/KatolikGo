import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getQuizByLevel } from '@/services/quizService';
import { submitLevelCompletion } from '@/services/levelService';
import { spendToken } from '@/services/tokenService';
import { consumeLifeOnWrongAnswer } from '@/services/livesService';
import { useGuestGuard } from '@/hooks/useGuestGuard';
import type { Quiz } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { TOKEN_REWARDS, LIVES_CONFIG } from '@/constants/xp.constants';
import { Routes } from '@/constants/routes';

const HINT_COST = TOKEN_REWARDS.HINT_COST;
const FIFTY_FIFTY_COST = 2;
const TIMER_SECONDS = 15;

export default function QuizPlayScreen() {
  const { level } = useLocalSearchParams<{ level: string }>();
  const { userData } = useAuth();
  const router = useRouter();
  const guestGuard = useGuestGuard();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [hinted, setHinted] = useState(false);
  const [livesExhausted] = useState(false);
  const [maxCombo, setMaxCombo] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const levelNum = Math.max(1, Math.min(Number(level) || 1, 100));
  const questions = quiz?.questions ?? [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQ];
  const lives = userData?.lives ?? LIVES_CONFIG.MAX;

  // Load quiz
  useEffect(() => {
    (async () => {
      try {
        const q = await getQuizByLevel(levelNum);
        setQuiz(q);
      } catch {
        Alert.alert('Ralat', 'Gagal memuatkan kuiz.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [levelNum, router]);

  // Check lives before starting
  useEffect(() => {
    if (!loading && lives <= 0 && !livesExhausted) {
      router.replace(Routes.QUIZ_LIVES_EMPTY);
    }
  }, [loading, lives, livesExhausted, router]);

  // Timer
  useEffect(() => {
    if (!quiz || answered || livesExhausted) return;
    setTimer(TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentQ, quiz, answered, livesExhausted]);

  const handleTimeUp = useCallback(() => {
    if (answered) return;
    setAnswered(true);
    setSelected(-1);
    setCombo(0);
    if (userData?.uid && !userData?.isGuest) {
      consumeLifeOnWrongAnswer(userData.uid).catch(() => {});
    }
  }, [answered, userData]);

  const handleAnswer = useCallback(
    (idx: number) => {
      if (answered || livesExhausted) return;
      if (timerRef.current) clearInterval(timerRef.current);
      setAnswered(true);
      setSelected(idx);

      const isCorrect = idx === currentQuestion?.correctAnswer;
      if (isCorrect) {
        setCorrectCount((c) => c + 1);
        setCombo((c) => c + 1);
        setScore((s) => s + Math.round(100 / totalQuestions));
      } else {
        setCombo(0);
        if (userData?.uid && !userData?.isGuest) {
          consumeLifeOnWrongAnswer(userData.uid).catch(() => {});
        }
      }
    },
    [answered, livesExhausted, currentQuestion, totalQuestions, userData]
  );

  // Track max combo
  useEffect(() => {
    setMaxCombo((m) => Math.max(m, combo));
  }, [combo]);

  const handleNext = useCallback(() => {
    if (currentQ < totalQuestions - 1) {
      setCurrentQ((c) => c + 1);
      setSelected(null);
      setAnswered(false);
      setEliminated([]);
      setHinted(false);
    } else {
      finishQuiz();
    }
  }, [currentQ, totalQuestions]);

  const finishQuiz = useCallback(async () => {
    if (!userData?.uid) return;
    try {
      const result = await submitLevelCompletion(userData.uid, levelNum, score, userData, {
        questionCount: totalQuestions,
        correctCount,
        maxCombo,
        hintsUsed,
      });
      router.replace({
        pathname: Routes.QUIZ_RESULT,
        params: {
          level: levelNum,
          score,
          correct: correctCount,
          total: totalQuestions,
          xp: result.xpEarned,
          tokens: result.tokensEarned,
          passed: result.completed ? '1' : '0',
        },
      });
    } catch {
      router.replace({
        pathname: Routes.QUIZ_RESULT,
        params: { level: levelNum, score, correct: correctCount, total: totalQuestions, xp: 0, tokens: 0, passed: '0' },
      });
    }
  }, [userData, levelNum, score, correctCount, totalQuestions, maxCombo, hintsUsed, router]);

  const handle5050 = useCallback(() => {
    if (!currentQuestion || eliminated.length > 0 || answered) return;
    if (!guestGuard.guard(() => {}, 'Kuasa 50/50')) return;
    if ((userData?.tokens ?? 0) < FIFTY_FIFTY_COST) {
      Alert.alert('Token Tidak Cukup', `Perlukan ${FIFTY_FIFTY_COST} token.`);
      return;
    }
    const wrong = currentQuestion.options
      .map((_, i) => i)
      .filter((i) => i !== currentQuestion.correctAnswer);
    const shuffled = wrong.sort(() => Math.random() - 0.5);
    setEliminated(shuffled.slice(0, 2));
    if (userData?.uid) {
      spendToken(userData.uid, FIFTY_FIFTY_COST, '50/50 Powerup').catch(() => {});
    }
  }, [currentQuestion, eliminated, answered, guestGuard, userData]);

  const handleHint = useCallback(() => {
    if (hinted || answered) return;
    if (!guestGuard.guard(() => {}, 'Petunjuk')) return;
    if ((userData?.tokens ?? 0) < HINT_COST) {
      Alert.alert('Token Tidak Cukup', `Perlukan ${HINT_COST} token.`);
      return;
    }
    setHinted(true);
    setHintsUsed((h) => h + 1);
    if (userData?.uid) {
      spendToken(userData.uid, HINT_COST, 'Hint Powerup').catch(() => {});
    }
  }, [hinted, answered, guestGuard, userData]);

  const handleQuit = useCallback(() => {
    Alert.alert('Keluar Kuiz', 'Anda pasti mahu keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => router.replace(Routes.PETA) },
    ]);
  }, [router]);

  if (loading || !quiz) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!currentQuestion) return null;

  const isCorrect = selected === currentQuestion.correctAnswer;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleQuit}>
          <Ionicons name="close" size={24} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>
        <Text style={styles.progress}>{currentQ + 1}/{totalQuestions}</Text>
        <View style={styles.livesRow}>
          {Array.from({ length: LIVES_CONFIG.MAX }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < lives ? 'heart' : 'heart-outline'}
              size={16}
              color={i < lives ? Colors.tertiary : Colors.onSurfaceVariant}
            />
          ))}
        </View>
      </View>

      {/* Timer Bar */}
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${(timer / TIMER_SECONDS) * 100}%` as any }]} />
      </View>

      {/* Question Card */}
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQuestion.question}</Text>
      </View>

      {/* Answers */}
      <View style={styles.answers}>
        {currentQuestion.options.map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isEliminated = eliminated.includes(idx);
          const isSelected = selected === idx;
          const showCorrect = answered && idx === currentQuestion.correctAnswer;
          const showWrong = answered && isSelected && !isCorrect;

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.answerBtn,
                isEliminated && styles.answerEliminated,
                showCorrect && styles.answerCorrect,
                showWrong && styles.answerWrong,
              ]}
              onPress={() => handleAnswer(idx)}
              disabled={answered || isEliminated}
            >
              <View style={[styles.letterBadge, showCorrect && styles.letterCorrect, showWrong && styles.letterWrong]}>
                <Text style={[styles.letterText, (showCorrect || showWrong) && styles.letterTextLight]}>{letter}</Text>
              </View>
              <Text style={[styles.answerText, isEliminated && styles.answerTextEliminated]} numberOfLines={2}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation (after answer) */}
      {answered && currentQuestion.explanation && (
        <View style={styles.explanation}>
          <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
        </View>
      )}

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        {!answered ? (
          <View style={styles.powerups}>
            <TouchableOpacity style={styles.powerupBtn} onPress={handle5050}>
              <Text style={styles.powerupText}>50/50</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.powerupBtn} onPress={handleHint}>
              <Ionicons name="bulb-outline" size={18} color={Colors.secondary} />
              <Text style={styles.powerupText}>Petunjuk</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>
              {currentQ < totalQuestions - 1 ? 'Seterusnya' : 'Selesai'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 50,
    paddingBottom: Spacing.sm,
  },
  progress: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  livesRow: { flexDirection: 'row', gap: 2 },

  // Timer
  timerTrack: {
    height: 4,
    marginHorizontal: Spacing.lg,
    borderRadius: 2,
    backgroundColor: 'rgba(14,42,77,0.6)',
    marginBottom: Spacing.lg,
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.secondary,
  },

  // Question
  questionCard: {
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.15)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  questionText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.creamSoft,
    lineHeight: 26,
  },

  // Answers
  answers: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  answerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14,42,77,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  answerEliminated: { opacity: 0.3 },
  answerCorrect: { borderColor: Colors.success, backgroundColor: 'rgba(16,185,129,0.15)' },
  answerWrong: { borderColor: Colors.error, backgroundColor: 'rgba(255,180,171,0.15)' },

  letterBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(26,58,92,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  letterCorrect: { backgroundColor: Colors.success },
  letterWrong: { backgroundColor: Colors.error },
  letterText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  letterTextLight: { color: Colors.white },

  answerText: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.creamSoft,
  },
  answerTextEliminated: { color: Colors.onSurfaceVariant },

  // Explanation
  explanation: {
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.secondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  explanationText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },

  // Bottom
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: 40,
  },
  powerups: {
    flexDirection: 'row',
    gap: 12,
  },
  powerupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.2)',
    backgroundColor: 'rgba(14,42,77,0.6)',
  },
  powerupText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.secondary,
  },
  nextBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.navyDark,
  },
});
