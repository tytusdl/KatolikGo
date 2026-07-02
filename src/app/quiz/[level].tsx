import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getQuizByLevel } from '@/services/quizService';
import { submitLevelCompletion } from '@/services/levelService';
import { spendToken } from '@/services/tokenService';
import type { Quiz } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const QUESTION_TIME = 15; // seconds per question
const FIFTY_FIFTY_COST = 2;
const HINT_COST = 1;

const BRAND = {
  bgTop: '#b8a4f5',
  bgMid: '#9c7ee8',
  bgBottom: '#7c5fd8',
  questionCard: '#ffffff',
  timerOrange: '#ff9d4d',
  timerRed: '#ff5b5b',
  correctGreen: '#7be2c9',
  correctGreenDeep: '#5dd0b3',
  wrongRed: '#ff7b7b',
  wrongRedDeep: '#ff5b5b',
  textDark: '#1f2347',
  textBody: '#3a3f6b',
  textMuted: '#8a90b8',
  actionOrange: '#ff8c5a',
  actionOrangeDeep: '#f97346',
  actionDisabled: '#d6cbe9',
  letterBg: '#f0eaff',
};

export default function QuizPlayScreen() {
  const { level } = useLocalSearchParams<{ level: string }>();
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  // New state for the redesigned UI
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME);
  const [fiftyFiftyUsed, setFiftyFiftyUsed] = useState(false);
  const [fiftyFiftyActive, setFiftyFiftyActive] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [skipUsed] = useState(false);
  const [freePassUsed, setFreePassUsed] = useState(false);
  const [shakeAnim] = useState(new Animated.Value(0));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const levelNum = parseInt(level || '1', 10);
  const totalQuestions = quiz?.questions.length ?? 0;

  useEffect(() => {
    if (!quiz || selectedAnswer !== null) return;
    startTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, quiz]);

  const startTimer = () => {
    stopTimer();
    setSecondsLeft(QUESTION_TIME);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTimeUp = () => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(-1); // sentinel for timeout
    setShowExplanation(true);
  };

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    try {
      const quizData = await getQuizByLevel(levelNum);
      setQuiz(quizData);
    } catch {
      Alert.alert('Ralat', 'Gagal memuat kuiz');
    } finally {
      setLoading(false);
    }
  }, [levelNum]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return;
    if (hiddenOptions.includes(index)) return;
    setSelectedAnswer(index);
    setShowExplanation(true);
    stopTimer();
    if (index !== quiz!.questions[currentQuestion].correctAnswer) {
      triggerShake();
    }
  };

  // --- Powerups ---

  const handleFiftyFifty = async () => {
    if (!quiz || fiftyFiftyUsed || fiftyFiftyActive || selectedAnswer !== null) return;
    if (!userData) {
      Alert.alert('Log masuk diperlukan', 'Sila log masuk untuk menggunakan hint.');
      return;
    }
    if (userData.tokens < FIFTY_FIFTY_COST) {
      Alert.alert('Token tidak cukup', `50/50 memerlukan ${FIFTY_FIFTY_COST} token.`);
      return;
    }

    try {
      await spendToken(userData.uid, FIFTY_FIFTY_COST, '50/50 powerup');
      const q = quiz.questions[currentQuestion];
      const wrongIndices = q.options
        .map((_, i) => i)
        .filter((i) => i !== q.correctAnswer);
      // shuffle and take 2
      const shuffled = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);
      setHiddenOptions(shuffled);
      setFiftyFiftyUsed(true);
      setFiftyFiftyActive(true);
    } catch (err: any) {
      Alert.alert('Ralat', err.message ?? 'Tidak dapat menggunakan 50/50.');
    }
  };

  const handleHint = async () => {
    if (!quiz || hintUsed || hintRevealed || selectedAnswer !== null) return;
    if (!userData) {
      Alert.alert('Log masuk diperlukan', 'Sila log masuk untuk menggunakan hint.');
      return;
    }
    if (userData.tokens < HINT_COST) {
      Alert.alert('Token tidak cukup', `Hint memerlukan ${HINT_COST} token.`);
      return;
    }
    try {
      await spendToken(userData.uid, HINT_COST, 'Hint powerup');
      setHintUsed(true);
      setHintRevealed(true);
    } catch (err: any) {
      Alert.alert('Ralat', err.message ?? 'Tidak dapat menunjukkan hint.');
    }
  };

  const handleFreePass = () => {
    if (freePassUsed || selectedAnswer !== null) return;
    if (!quiz) return;
    // 1 free skip per session
    setFreePassUsed(true);
    stopTimer();
    proceedToNext(false);
  };

  const proceedToNext = (didScore: boolean) => {
    if (!quiz) return;
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion((p) => p + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setHintRevealed(false);
      setFiftyFiftyActive(false);
      setHiddenOptions([]);
      return;
    }
    finishQuiz(didScore ? score + 100 / quiz.questions.length : score);
  };

  const handleNext = async () => {
    if (!quiz) {
      Alert.alert('Ralat', 'Kuiz belum dimuatkan');
      return;
    }

    const question = quiz.questions[currentQuestion];
    let newScore = score;

    if (selectedAnswer === question.correctAnswer) {
      newScore = score + 100 / quiz.questions.length;
      setScore(newScore);
    }

    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion((p) => p + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setHintRevealed(false);
      setFiftyFiftyActive(false);
      setHiddenOptions([]);
      return;
    }

    finishQuiz(newScore);
  };

  const finishQuiz = async (finalScore: number) => {
    const percentage = Math.round(finalScore);

    if (!userData) {
      router.replace({
        pathname: '/quiz/result',
        params: {
          level: levelNum.toString(),
          score: percentage.toString(),
          tokens: '0',
          unlocked: 'false',
        },
      });
      return;
    }

    try {
      const { tokensEarned, nextLevelUnlocked } = await submitLevelCompletion(
        userData.uid,
        levelNum,
        percentage,
        userData
      );

      router.replace({
        pathname: '/quiz/result',
        params: {
          level: levelNum.toString(),
          score: percentage.toString(),
          tokens: tokensEarned.toString(),
          unlocked: nextLevelUnlocked.toString(),
        },
      });
    } catch {
      router.replace({
        pathname: '/quiz/result',
        params: {
          level: levelNum.toString(),
          score: percentage.toString(),
          tokens: '0',
          unlocked: 'false',
        },
      });
    }
  };

  if (loading || !quiz) {
    return (
      <LinearGradient
        colors={[BRAND.bgTop, BRAND.bgMid, BRAND.bgBottom]}
        style={styles.loading}
      >
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  const question = quiz.questions[currentQuestion];
  const timerPct = (secondsLeft / QUESTION_TIME) * 100;

  return (
    <LinearGradient
      colors={[BRAND.bgTop, BRAND.bgMid, BRAND.bgBottom]}
      style={styles.container}
    >
      {/* Decorative blurred blobs to mimic the soft gradient vibe */}
      <View style={styles.blobTop} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={BRAND.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Soalan {currentQuestion + 1}/{totalQuestions}
        </Text>
        <TouchableOpacity
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="book-outline" size={22} color={BRAND.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Question card */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{question.question}</Text>
        </View>

        {/* Timer bar */}
        <View style={styles.timerRow}>
          <Text style={styles.timerLabel}>Time</Text>
          <View style={styles.timerBarBg}>
            <LinearGradient
              colors={
                secondsLeft <= 5
                  ? [BRAND.timerOrange, BRAND.timerRed]
                  : ['#ffc371', BRAND.timerOrange]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.timerBarFill, { width: `${timerPct}%` }]}
            />
          </View>
          <Text style={styles.timerCount}>
            {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
            {String(secondsLeft % 60).padStart(2, '0')}
          </Text>
        </View>

        {/* Optional hint preview */}
        {hintRevealed && selectedAnswer === null && (
          <View style={styles.hintCard}>
            <Ionicons name="bulb" size={16} color="#fff" />
            <Text style={styles.hintText} numberOfLines={3}>
              {question.explanation}
            </Text>
          </View>
        )}

        {/* Answer options */}
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          {question.options.map((option, index) => {
            const isCorrect = index === question.correctAnswer;
            const isSelected = index === selectedAnswer;
            const isHidden = hiddenOptions.includes(index);
            const revealed = selectedAnswer !== null || isSelected;

            let bgColor = '#ffffff';
            let borderColor = 'transparent';
            let textColor = BRAND.textDark;
            let letterBg = BRAND.letterBg;
            let letterColor = BRAND.textDark;

            if (isHidden) {
              return null;
            }

            if (revealed) {
              if (isCorrect) {
                bgColor = BRAND.correctGreen;
                borderColor = BRAND.correctGreenDeep;
                letterBg = '#ffffff';
                letterColor = BRAND.correctGreenDeep;
                textColor = '#ffffff';
              } else if (isSelected) {
                bgColor = BRAND.wrongRed;
                borderColor = BRAND.wrongRedDeep;
                letterBg = '#ffffff';
                letterColor = BRAND.wrongRedDeep;
                textColor = '#ffffff';
              } else {
                bgColor = '#ffffff';
                textColor = BRAND.textMuted;
                letterBg = BRAND.letterBg;
                letterColor = BRAND.textMuted;
              }
            }

            return (
              <TouchableOpacity
                key={index}
                style={[styles.option, { backgroundColor: bgColor, borderColor }]}
                onPress={() => handleAnswerSelect(index)}
                disabled={revealed || isHidden}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.optionLetter,
                    { backgroundColor: letterBg, borderColor },
                  ]}
                >
                  <Text style={[styles.optionLetterText, { color: letterColor }]}>
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text style={[styles.optionText, { color: textColor }]} numberOfLines={2}>
                  {option}
                </Text>
                {revealed && isCorrect && (
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                )}
                {revealed && isSelected && !isCorrect && (
                  <Ionicons name="close-circle" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Explanation after answer */}
        {showExplanation && (
          <View style={styles.explanationBox}>
            <View style={styles.explanationHeader}>
              <Ionicons name="book" size={16} color={BRAND.textDark} />
              <Text style={styles.explanationTitle}>Penjelasan</Text>
            </View>
            <Text style={styles.explanationText}>{question.explanation}</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.actionBarWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <LinearGradient
          colors={[BRAND.actionOrange, BRAND.actionOrangeDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.actionBar}
        >
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleFiftyFifty}
            disabled={fiftyFiftyUsed || selectedAnswer !== null}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, fiftyFiftyUsed && styles.actionIconDisabled]}>
              <Ionicons
                name="grid-outline"
                size={22}
                color={fiftyFiftyUsed ? '#bda9d4' : '#fff'}
              />
            </View>
            <Text style={[styles.actionLabel, fiftyFiftyUsed && styles.actionLabelDisabled]}>
              50:50
            </Text>
            <Text style={[styles.actionSub, fiftyFiftyUsed && styles.actionLabelDisabled]}>
              {fiftyFiftyUsed ? 'USED' : `${FIFTY_FIFTY_COST} TOKEN`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleHint}
            disabled={hintUsed || selectedAnswer !== null}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, hintUsed && styles.actionIconDisabled]}>
              <Ionicons
                name="bulb-outline"
                size={22}
                color={hintUsed ? '#bda9d4' : '#fff'}
              />
            </View>
            <Text style={[styles.actionLabel, hintUsed && styles.actionLabelDisabled]}>
              HINT
            </Text>
            <Text style={[styles.actionSub, hintUsed && styles.actionLabelDisabled]}>
              {hintUsed ? 'USED' : `${HINT_COST} TOKEN`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} activeOpacity={0.85} disabled>
            <View style={[styles.actionIcon, styles.actionIconDisabled]}>
              <Ionicons name="add-circle-outline" size={22} color="#bda9d4" />
            </View>
            <Text style={[styles.actionLabel, styles.actionLabelDisabled]}>BUY MORE</Text>
            <Text style={[styles.actionSub, styles.actionLabelDisabled]}>SOON</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={skipUsed || freePassUsed ? undefined : handleFreePass}
            disabled={selectedAnswer !== null || freePassUsed}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.actionIcon,
                (freePassUsed || skipUsed) && styles.actionIconDisabled,
              ]}
            >
              <Ionicons
                name="play-forward"
                size={22}
                color={freePassUsed || skipUsed ? '#bda9d4' : '#fff'}
              />
            </View>
            <Text
              style={[
                styles.actionLabel,
                (freePassUsed || skipUsed) && styles.actionLabelDisabled,
              ]}
            >
              SKIP
            </Text>
            <Text
              style={[
                styles.actionSub,
                (freePassUsed || skipUsed) && styles.actionLabelDisabled,
              ]}
            >
              {freePassUsed || skipUsed ? 'USED' : 'FREE'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Sticky "Next" button after answering */}
      {selectedAnswer !== null && (
        <View
          style={[
            styles.nextButtonContainer,
            { bottom: Math.max(insets.bottom, 12) + 84 },
          ]}
        >
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>
              {currentQuestion < quiz.questions.length - 1
                ? 'Seterusnya'
                : 'Hantar Jawapan'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color="#fff"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blobTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(124,95,216,0.35)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.4,
  },

  // Scroll area
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },

  // Question card
  questionCard: {
    backgroundColor: BRAND.questionCard,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 22,
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  questionText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: BRAND.textDark,
    textAlign: 'center',
  },

  // Timer
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    width: 38,
  },
  timerBarBg: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  timerCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    minWidth: 42,
    textAlign: 'right',
  },

  // Hint card
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 12,
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: BRAND.textDark,
  },

  // Options
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 2,
    shadowColor: '#3a2766',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  optionLetter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0eaff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionLetterText: {
    fontSize: 16,
    fontWeight: '800',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },

  // Explanation
  explanationBox: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 14,
    marginTop: 6,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.textDark,
    marginLeft: 6,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
    color: BRAND.textBody,
  },

  // Action bar (bottom)
  actionBarWrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  actionBar: {
    flexDirection: 'row',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionIconDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  actionSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  actionLabelDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },

  // Next button
  nextButtonContainer: {
    position: 'absolute',
    left: 18,
    right: 18,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#1f2347',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

// SCREEN_WIDTH reserved for future responsive tweaks
void SCREEN_WIDTH;
