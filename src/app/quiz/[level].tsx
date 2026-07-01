import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getQuizByLevel } from '@/services/quizService';
import { submitLevelCompletion } from '@/services/levelService';
import type { Quiz } from '@/types';
import { Colors, Spacing, FontSize } from '@/constants/theme';

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

  const levelNum = parseInt(level || '1', 10);

  useEffect(() => {
    loadQuiz();
  }, [levelNum]);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const quizData = await getQuizByLevel(levelNum);
      setQuiz(quizData);
    } catch (error) {
      Alert.alert('Ralat', 'Gagal memuat kuiz');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowExplanation(true);
  };

  const handleNext = async () => {
    if (!quiz || !userData) {
      Alert.alert('Debug', 'Quiz or userData missing');
      return;
    }

    const question = quiz.questions[currentQuestion];
    let newScore = score;

    if (selectedAnswer === question.correctAnswer) {
      newScore = score + (100 / quiz.questions.length);
      setScore(newScore);
    }

    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      const percentage = Math.round(newScore);
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
      } catch (error: any) {
        Alert.alert('Debug', 'Error: ' + error.message);
        // Still navigate even if submission fails
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
    }
  };

  if (loading || !quiz) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.levelTitle}>Tahap {levelNum}</Text>
        <Text style={styles.progress}>
          Soalan {currentQuestion + 1}/{quiz.questions.length}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView style={styles.questionScroll} contentContainerStyle={styles.questionContent}>
        <Text style={styles.question}>{question.question}</Text>

        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => {
            const isCorrect = index === question.correctAnswer;
            const isSelected = index === selectedAnswer;
            const backgroundColor = selectedAnswer !== null
              ? isCorrect
                ? Colors.success
                : isSelected
                ? Colors.error
                : Colors.light.surfaceAlt
              : Colors.light.surfaceAlt;
            const textColor = selectedAnswer !== null && (isCorrect || isSelected)
              ? Colors.white
              : Colors.primary;

            return (
              <TouchableOpacity
                key={index}
                style={[styles.option, { backgroundColor }]}
                onPress={() => handleAnswerSelect(index)}
                disabled={selectedAnswer !== null}
                activeOpacity={0.7}
              >
                <View style={styles.optionRow}>
                  <Text style={[styles.optionText, { color: textColor }]}>{option}</Text>
                  {selectedAnswer !== null && isCorrect && (
                    <Text style={styles.optionIcon}>✓</Text>
                  )}
                  {selectedAnswer !== null && isSelected && !isCorrect && (
                    <Text style={styles.optionIcon}>✗</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {showExplanation && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationTitle}>📖 Penjelasan:</Text>
            <Text style={styles.explanation}>{question.explanation}</Text>
          </View>
        )}
      </ScrollView>

      {selectedAnswer !== null && (
        <View style={styles.nextButtonContainer}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
            <Text style={styles.nextButtonText}>
              {currentQuestion < quiz.questions.length - 1 ? 'Seterusnya →' : 'Hantar Jawapan 🎉'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.md,
  },
  levelTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  progress: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 4,
    marginBottom: Spacing.lg,
  },
  progressFill: {
    height: 8,
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  questionScroll: {
    flex: 1,
  },
  questionContent: {
    paddingBottom: Spacing.lg,
  },
  question: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  option: {
    padding: Spacing.md,
    borderRadius: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: FontSize.md,
    flex: 1,
  },
  optionIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  explanationBox: {
    backgroundColor: Colors.light.surfaceAlt,
    padding: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.lg,
  },
  explanationTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  explanation: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  nextButtonContainer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  nextButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: 'bold',
  },
});
