import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getQuizByLevel } from '@/services/quizService';
import { submitLevelCompletion } from '@/services/levelService';
import { spendToken } from '@/services/tokenService';
import { consumeLifeOnWrongAnswer } from '@/services/livesService';
import { useGuestGuard } from '@/hooks/useGuestGuard';
import type { Quiz, QuizCategory } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { TOKEN_REWARDS, LIVES_CONFIG } from '@/constants/xp.constants';
import { Routes } from '@/constants/routes';

const HINT_COST = TOKEN_REWARDS.HINT_COST;
const FIFTY_FIFTY_COST = 2;
const TIMER_SECONDS = 15;

const CATEGORY_BADGES: Record<QuizCategory, string> = {
  old_testament: 'PL',
  new_testament: 'PB',
  ccc: 'KGK',
  sacraments: 'SK',
  liturgy: 'LT',
};

const CATEGORY_FULL: Record<QuizCategory, string> = {
  old_testament: 'PERJANJIAN LAMA',
  new_testament: 'PERJANJIAN BARU',
  ccc: 'KATEKISMUS GEREJA',
  sacraments: 'SAKRAMEN',
  liturgy: 'LITURGI',
};

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
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [hinted, setHinted] = useState(false);
  const [livesExhausted] = useState(false);
  const [maxCombo, setMaxCombo] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [timerProgress, setTimerProgress] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerAnim = useRef(new Animated.Value(1)).current;

  const levelNum = Math.max(1, Math.min(Number(level) || 1, 100));
  const questions = quiz?.questions ?? [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQ];
  const lives = userData?.lives ?? LIVES_CONFIG.MAX;

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

  useEffect(() => {
    if (!loading && lives <= 0 && !livesExhausted) {
      router.replace(Routes.QUIZ_LIVES_EMPTY);
    }
  }, [loading, lives, livesExhausted, router]);

  useEffect(() => {
    if (!quiz || answered || livesExhausted) return;
    let remaining = TIMER_SECONDS;
    setTimerProgress(1);
    timerAnim.setValue(1);
    Animated.timing(timerAnim, {
      toValue: 0,
      duration: TIMER_SECONDS * 1000,
      useNativeDriver: false,
    }).start();
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimerProgress(remaining / TIMER_SECONDS);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleTimeUp();
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      timerAnim.stopAnimation();
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
    [answered, livesExhausted, currentQuestion, totalQuestions, userData, timerAnim]
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSkip = useCallback(() => {
    if (answered) return;
    if (currentQ < totalQuestions - 1) {
      setCurrentQ((c) => c + 1);
      setSelected(null);
      setAnswered(false);
      setEliminated([]);
      setHinted(false);
    } else {
      finishQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, currentQ, totalQuestions]);

  const handleQuit = useCallback(() => {
    Alert.alert('Keluar Kuiz', 'Anda pasti mahu keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => router.replace(Routes.PETA) },
    ]);
  }, [router]);

  if (loading || !quiz) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!currentQuestion) return null;

  const isCorrect = selected === currentQuestion.correctAnswer;
  const progressPct = ((currentQ + 1) / totalQuestions) * 100;
  const categoryBadge = quiz ? CATEGORY_BADGES[quiz.category] : 'PL';
  const categoryFull = quiz ? CATEGORY_FULL[quiz.category] : 'FAKTA';
  const timerBarColor = timerProgress > 0.4 ? Colors.accent : timerProgress > 0.2 ? Colors.warning : Colors.error;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleQuit} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>PERINGKAT {levelNum}</Text>
            <View style={styles.headerProgressRow}>
              <View style={styles.headerProgressTrack}>
                <View
                  style={[
                    styles.headerProgressFill,
                    { width: `${progressPct}%` as any },
                  ]}
                />
              </View>
              <Text style={styles.headerProgressText}>
                {currentQ + 1}/{totalQuestions}
              </Text>
            </View>
          </View>
          <View style={styles.livesPill}>
            {Array.from({ length: LIVES_CONFIG.MAX }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < lives ? 'heart' : 'heart-outline'}
                size={14}
                color={i < lives ? Colors.error : Colors.textMuted}
              />
            ))}
            <Text style={styles.livesCount}>{lives}</Text>
          </View>
        </View>

        {/* Timer bar */}
        <View style={styles.timerTrack}>
          <Animated.View
            style={[
              styles.timerFill,
              {
                backgroundColor: timerBarColor,
                width: timerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{categoryBadge}</Text>
          </View>
        </View>

        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="book" size={48} color={Colors.accent} />
          </View>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{categoryFull}</Text>
          </View>
        </View>

        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>

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
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.letterBadge,
                    showCorrect && styles.letterCorrect,
                    showWrong && styles.letterWrong,
                  ]}
                >
                  <Text
                    style={[
                      styles.letterText,
                      (showCorrect || showWrong) && styles.letterTextLight,
                    ]}
                  >
                    {letter}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.answerText,
                    isEliminated && styles.answerTextEliminated,
                    showCorrect && styles.answerTextCorrect,
                    showWrong && styles.answerTextWrong,
                  ]}
                  numberOfLines={2}
                >
                  {opt}
                </Text>
                {showCorrect && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={Colors.accent}
                  />
                )}
                {showWrong && (
                  <Ionicons
                    name="close-circle"
                    size={22}
                    color={Colors.error}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {answered && currentQuestion.explanation && (
          <View style={styles.explanation}>
            <View style={styles.explanationDot} />
            <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        {!answered ? (
          <View style={styles.powerups}>
            <TouchableOpacity style={styles.powerupBtn} onPress={handleHint} activeOpacity={0.7}>
              <Ionicons name="bulb-outline" size={16} color={Colors.text} />
              <Text style={styles.powerupText}>Petunjuk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.powerupBtn}
              onPress={handle5050}
              activeOpacity={0.7}
            >
              <Ionicons name="remove-circle-outline" size={16} color={Colors.text} />
              <Text style={styles.powerupText}>50/50</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.powerupBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Ionicons name="play-skip-forward-outline" size={16} color={Colors.text} />
              <Text style={styles.powerupText}>Langkau</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.checkBtn} onPress={handleNext} activeOpacity={0.8}>
            <Text style={styles.checkBtnText}>
              {currentQ < totalQuestions - 1 ? 'Seterusnya' : 'Selesai'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={Colors.white}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scrollContent: {
    paddingBottom: 120,
    paddingTop: 50,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    gap: 4,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  headerProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  headerProgressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  headerProgressText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  livesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  livesCount: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    marginLeft: 2,
  },

  timerTrack: {
    height: 4,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
    borderRadius: 2,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
  },

  badgeRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.text,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
    letterSpacing: 1.2,
  },

  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTag: {
    position: 'absolute',
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.accent,
  },
  categoryTagText: {
    fontSize: 8,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
    letterSpacing: 1,
  },

  questionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  questionText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },

  answers: {
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  answerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  answerEliminated: { opacity: 0.25 },
  answerCorrect: {
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  answerWrong: {
    borderColor: Colors.error,
    backgroundColor: Colors.surface,
  },
  letterBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  letterCorrect: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  letterWrong: { backgroundColor: Colors.error, borderColor: Colors.error },
  letterText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  letterTextLight: { color: Colors.white },
  answerText: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
  },
  answerTextEliminated: { color: Colors.textMuted },
  answerTextCorrect: { color: Colors.accent },
  answerTextWrong: { color: Colors.error },

  explanation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  explanationDot: {
    width: 4,
    height: '100%',
    minHeight: 20,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 2,
  },
  explanationText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 20,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: 36,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  powerups: {
    flexDirection: 'row',
    gap: 10,
  },
  powerupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  powerupText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.text,
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
  },
  checkBtnText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },
});
