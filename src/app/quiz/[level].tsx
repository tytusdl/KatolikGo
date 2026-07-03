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
import { spendToken, GUEST_SPEND_BLOCKED } from '@/services/tokenService';
import {
  consumeLifeOnWrongAnswer,
  getEffectiveLives,
  type LivesState,
} from '@/services/livesService';
import { LivesIndicator, openLivesExhaustedModal } from '@/components/LivesIndicator';
import { LIVES_CONFIG } from '@/constants/xp.constants';
import { shuffleArray } from '@/utils/misc.utils';
import { validateResponseTime, validateSessionTimings } from '@/utils/anti-cheat.utils';
import { useGuestGuard } from '@/hooks/useGuestGuard';
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
  const { guard, isGuest } = useGuestGuard();
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

  // Per-question analytics captured during play, then passed to
  // `submitLevelCompletion` so XP / tokens reflect combo + perfect-score
  // bonuses, not just a flat score × multiplier.
  const questionStartTimeRef = useRef<number>(0);
  const responseTimesRef = useRef<number[]>([]);
  const correctCountRef = useRef<number>(0);
  const currentComboRef = useRef<number>(0);
  const maxComboRef = useRef<number>(0);
  // Pulse trigger for the banner lives indicator. Bumped each
  // time a life is lost so the heart visibly "thumps" and the
  // player gets immediate feedback. LivesIndicator reads
  // `pulseToken` as a counter (not a value) — bumping it fires
  // a single animation regardless of magnitude. The actual
  // lives value comes from `userData.lives` via auth context
  // (LivesIndicator reads it directly), so we don't need a
  // local mirror anymore — that was only required when the
  // lives pill was rendered inline with hard-coded props.
  const [livesPulseToken, setLivesPulseToken] = useState<number>(0);
  // True when lives hit 0 *during* this quiz — used to end the
  // session early and route to the result screen with a flag that
  // tells the result page to render the "habis lives" panel.
  const [livesExhausted, setLivesExhausted] = useState<boolean>(false);

  const levelNum = parseInt(level || '1', 10);
  const totalQuestions = quiz?.questions.length ?? 0;

  useEffect(() => {
    if (!quiz || selectedAnswer !== null) return;
    startTimer();
    // Reset per-question timer the moment a new question enters play.
    // Late-state resets (mid-question) are filtered by the selectedAnswer
    // guard above.
    questionStartTimeRef.current = Date.now();
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

  const handleTimeUp = async () => {
    if (selectedAnswer !== null) return;
    // Timeouts count as a wrong answer at the full timer duration. This
    // mirrors an explicit answer, so anti-cheat and XP math see the
    // same shape either way.
    const responseTime = Date.now() - questionStartTimeRef.current;
    recordResponse(responseTime, false);
    setSelectedAnswer(-1); // sentinel for timeout
    setShowExplanation(true);
    // Timeouts also drain a life — same path as an explicit wrong
    // answer. Without this, a player could idle through a quiz and
    // never lose any lives.
    await consumeLifeAfterWrongAnswer();
  };

  /**
   * Capture per-question analytics + run a single-answer anti-cheat
   * check. Cheaper to log here than to retro-fit the pattern check at
   * the end of the session — a single too-fast answer is a strong
   * signal even when the rest of the run looks human.
   */
  const recordResponse = (responseTimeMs: number, isCorrect: boolean) => {
    const check = validateResponseTime(responseTimeMs);
    if (!check.ok) {
      console.warn(
        `[quiz anti-cheat] q${currentQuestion + 1} response=${responseTimeMs}ms → ${check.reason}`
      );
    }
    responseTimesRef.current.push(responseTimeMs);
    if (isCorrect) {
      correctCountRef.current += 1;
      currentComboRef.current += 1;
      if (currentComboRef.current > maxComboRef.current) {
        maxComboRef.current = currentComboRef.current;
      }
    } else {
      currentComboRef.current = 0;
    }
  };

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    try {
      // Pre-quiz lives gate. Read the effective lives (with any
      // pending time-based refill applied) before loading the quiz
      // so we can short-circuit to the lives-exhausted modal when the
      // user has 0. The banner indicator itself reads from auth
      // context (`userData.lives`) so we don't need to mirror it
      // locally — this is just the gate.
      let effectiveLives: number = LIVES_CONFIG.MAX;
      if (userData?.uid) {
        try {
          const state: LivesState = await getEffectiveLives(userData.uid);
          effectiveLives = state.lives;
        } catch {
          // Network/perm error — fall back to "assume full health"
          // rather than blocking the player from playing.
          effectiveLives = LIVES_CONFIG.MAX;
        }
      }
      if (effectiveLives <= 0) {
        // Lives habis — bounce straight to the refill modal. We use
        // `replace` so the quiz URL doesn't sit in the back stack;
        // when the modal closes the user lands back on the quiz list.
        router.replace('/quiz/lives-empty');
        return;
      }
      const quizData = await getQuizByLevel(levelNum);
      setQuiz(quizData);
      // Per-session analytics reset. Without this, a retry on the same
      // mount (router back-and-forth into the same screen) would carry
      // correctCount / maxCombo / responseTimes from the prior play.
      responseTimesRef.current = [];
      correctCountRef.current = 0;
      currentComboRef.current = 0;
      maxComboRef.current = 0;
    } catch {
      Alert.alert('Ralat', 'Gagal memuat kuiz');
    } finally {
      setLoading(false);
    }
  }, [levelNum, userData?.uid]);

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

  const handleAnswerSelect = async (index: number) => {
    if (selectedAnswer !== null) return;
    if (hiddenOptions.includes(index)) return;
    setSelectedAnswer(index);
    setShowExplanation(true);
    stopTimer();
    const isCorrect = index === quiz!.questions[currentQuestion].correctAnswer;
    const responseTimeMs = Date.now() - questionStartTimeRef.current;
    recordResponse(responseTimeMs, isCorrect);
    if (!isCorrect) {
      triggerShake();
      // Drain a life via the transactional service. The local
      // `lives` state is updated optimistically so the header row
      // reflects the loss immediately; the Firestore write happens
      // concurrently. If the user runs out mid-quiz we end the
      // session early so the player isn't staring at the rest of
      // the questions they can't pass anyway.
      await consumeLifeAfterWrongAnswer();
    }
  };

  /**
   * Decrement lives (one transaction in `livesService`) and update
   * the local mirror state. If lives hit 0, mark the session as
   * exhausted so the next "Seterusnya" press ends the quiz and
   * routes to the result screen with the lives-exhausted flag.
   */
  const consumeLifeAfterWrongAnswer = async () => {
    if (!userData?.uid) return;
    try {
      const next = await consumeLifeOnWrongAnswer(userData.uid);
      if (next <= 0) {
        setLivesExhausted(true);
      }
    } catch {
      // Non-fatal — the banner shows the cached `userData.lives`
      // value via auth context. The next wrong answer will retry
      // the transaction. We intentionally don't block the quiz
      // on a Firestore blip — worst case the player gets one
      // extra question in before the next attempt to decrement
      // catches up.
    }
    // Pulse the banner regardless of success so the player gets
    // visible feedback even if Firestore is lagging. The counter
    // only needs to differ from the last value, so a simple
    // `prev => prev + 1` works.
    setLivesPulseToken((prev) => prev + 1);
  };

  // --- Powerups ---

  const handleFiftyFifty = async () => {
    if (!quiz || fiftyFiftyUsed || fiftyFiftyActive || selectedAnswer !== null) return;
    if (!userData) {
      Alert.alert('Log masuk diperlukan', 'Sila log masuk untuk menggunakan hint.');
      return;
    }
    // Guest gate: block the powerup with a friendly Daftar / Log Masuk
    // prompt before we even attempt the spend. The service-side check
    // in `spendToken` is the canonical gate; this is a UX nudge.
    if (isGuest) {
      guard(() => undefined, 'Powerup 50/50');
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
      // Proper Fisher-Yates shuffle (was `sort(() => Math.random() - 0.5)`
      // — biased toward short arrays and not uniform).
      const shuffled = shuffleArray(wrongIndices).slice(0, 2);
      setHiddenOptions(shuffled);
      setFiftyFiftyUsed(true);
      setFiftyFiftyActive(true);
    } catch (err: any) {
      // `GUEST_SPEND_BLOCKED` is surfaced by the service if a guest slips
      // past the pre-check (e.g. session flip mid-play). Translate to the
      // friendly Daftar / Log Masuk prompt instead of "Insufficient tokens".
      if (err?.code === GUEST_SPEND_BLOCKED) {
        guard(() => undefined, 'Powerup 50/50');
        return;
      }
      Alert.alert('Ralat', err.message ?? 'Tidak dapat menggunakan 50/50.');
    }
  };

  const handleHint = async () => {
    if (!quiz || hintUsed || hintRevealed || selectedAnswer !== null) return;
    if (!userData) {
      Alert.alert('Log masuk diperlukan', 'Sila log masuk untuk menggunakan hint.');
      return;
    }
    if (isGuest) {
      guard(() => undefined, 'Hint');
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
      if (err?.code === GUEST_SPEND_BLOCKED) {
        guard(() => undefined, 'Hint');
        return;
      }
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

    // Lives exhausted → end the session now regardless of which
    // question we're on. Player keeps whatever score they've
    // earned so far; the result screen will surface the
    // "Nyawa habis" panel via the `livesExhausted` URL param.
    if (livesExhausted) {
      finishQuiz(newScore, true);
      return;
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

    finishQuiz(newScore, false);
  };

  const finishQuiz = async (finalScore: number, livesFlippedToZero: boolean = false) => {
    const percentage = Math.round(finalScore);

    if (!userData) {
      router.replace({
        pathname: '/quiz/result',
        params: {
          level: levelNum.toString(),
          score: percentage.toString(),
          tokens: '0',
          unlocked: 'false',
          livesExhausted: livesFlippedToZero ? 'true' : 'false',
        },
      });
      return;
    }

    // Run the session-level anti-cheat pattern check before reporting
    // the result. Per-answer checks already ran during play; this
    // catches suspicious uniform-fast timing that a too-fast single
    // answer wouldn't (e.g. a paced bot).
    const sessionCheck = validateSessionTimings(responseTimesRef.current);
    if (!sessionCheck.pattern.ok) {
      console.warn(
        `[quiz anti-cheat] session pattern flagged: ${sessionCheck.pattern.reason}`
      );
    }

    try {
      const { tokensEarned, nextLevelUnlocked } = await submitLevelCompletion(
        userData.uid,
        levelNum,
        percentage,
        userData,
        {
          questionCount: quiz!.questions.length,
          correctCount: correctCountRef.current,
          maxCombo: maxComboRef.current,
          hintsUsed: hintUsed ? 1 : 0,
          skipsUsed: freePassUsed ? 1 : 0,
        }
      );

      router.replace({
        pathname: '/quiz/result',
        params: {
          level: levelNum.toString(),
          score: percentage.toString(),
          tokens: tokensEarned.toString(),
          unlocked: nextLevelUnlocked.toString(),
          livesExhausted: livesFlippedToZero ? 'true' : 'false',
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
          livesExhausted: livesFlippedToZero ? 'true' : 'false',
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
        {/* Right side reserved for visual balance — the prominent
            lives indicator now lives in the body (banner variant
            below the question card) where the player can't miss
            it during play. Previously the lives pill competed for
            space here with the question number; now it's its own
            thing. */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 200 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Prominent lives banner — sits at the top of the scroll
            content so the player sees remaining lives at a glance
            while answering. Bigger than the previous header pill
            (~56px tall vs. 36px), self-shadowed so it pops off
            the lavender gradient, and pulse-driven on every wrong
            answer (see `livesPulseToken`). Tap routes to the
            refill modal — gives the player a low-friction way to
            top up without leaving the quiz mid-session. */}
        <LivesIndicator
          variant="banner"
          pulseToken={livesPulseToken}
          onPress={() => openLivesExhaustedModal(router)}
        />

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

      {/* Bottom area — sticky footer with the "Seterusnya" button on top
          (only after the player answers) and the powerup action bar
          always at the very bottom. Both are in normal column flow so
          there's no absolute-positioning overlap or tap-through — the
          previous absolute layout let the Seterusnya container's
          transparent corners catch on the action bar below and trigger
          a powerup instead. */}
      <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {selectedAnswer !== null && (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
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
        )}

        <View style={styles.actionBarWrap}>
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
              activeOpacity={0.6}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
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
              activeOpacity={0.6}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
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

            <TouchableOpacity style={styles.actionItem} activeOpacity={0.6} disabled>
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
              activeOpacity={0.6}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
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
      </View>
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
  // Right-side balance block for the header — same width as the
  // back-button (40px) so the question title stays optically
  // centered. Lives no longer live here; the banner variant
  // below the question card is the primary surface.
  headerSpacer: {
    width: 40,
    height: 40,
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
    paddingTop: 14,
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

  // Bottom area (sticky footer holding "Seterusnya" above the action bar)
  bottomArea: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  // Action bar (bottom)
  actionBarWrap: {
    paddingHorizontal: 0,
    paddingTop: 8,
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
    backgroundColor: 'rgba(255,255,255,0.22)',
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

  // "Seterusnya" / "Hantar Jawapan" button (sits above the action bar
  // when an answer is selected)
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#1f2347',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
