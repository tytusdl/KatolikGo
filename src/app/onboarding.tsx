import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useState, useLayoutEffect } from 'react';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { useAuth } from '@/contexts/AuthContext';

type OnboardingSlide = {
  id: number;
  title: string;
  subtitle: string;
  bgColor: string;
  emoji: string;
  badge?: string;
};

const SLIDES: OnboardingSlide[] = [
  {
    id: 1,
    title: 'Belajar Iman\nYang Menyeronokkan',
    subtitle: 'Main, belajar, dan mendalami iman Katolik dengan cara yang menyeronokkan dan interaktif',
    bgColor: '#DBEAFE', // Light blue
    emoji: '📖',
    badge: '📚 Pelajaran',
  },
  {
    id: 2,
    title: 'Teka Gambar\n"Siapa Saya?"',
    subtitle: 'Teka tokoh Alkitab, Para Kudus, Paus & objek liturgi melalui gambar visual',
    bgColor: '#FCE7F3', // Light pink
    emoji: '🖼️',
    badge: '🧩 Teka',
  },
  {
    id: 3,
    title: 'Bersaing Dengan\nKomuniti',
    subtitle: 'Bersaing dalam papan pendahulu dengan umat Kristian seluruh dunia. Naik ranking!',
    bgColor: '#D1FAE5', // Light green
    emoji: '🏆',
    badge: '🎮 Seru!',
  },
  {
    id: 4,
    title: 'Kumpul Ganjaran\n& Pencapaian',
    subtitle: 'Dapatkan token, XP, dan lencana digital untuk dikongsi dengan rakan',
    bgColor: '#FEF3C7', // Light yellow
    emoji: '🎁',
    badge: '✨ Ganjaran',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, markOnboarded } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Root layout uses <Slot /> instead of <Stack />, so this screen has no
  // parent Stack to inherit header options from. Set them inline so the
  // native-stack header doesn't appear over the onboarding artwork.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleNext = async () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
      return;
    }
    // Last slide: persist "onboarded" flag (AsyncStorage + in-memory state
    // via AuthContext), then let AuthGate route based on whether we're
    // signed in.
    await markOnboarded();
    if (user) {
      router.replace(Routes.HOME);
    } else {
      router.replace(Routes.LOGIN);
    }
  };

  const handleSkip = async () => {
    await markOnboarded();
    if (user) {
      router.replace(Routes.HOME);
    } else {
      router.replace(Routes.LOGIN);
    }
  };

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      {/* Top Color Block Section */}
      <View style={[styles.topSection, { backgroundColor: slide.bgColor }]}>
        {/* Skip Button */}
        {!isLast && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Langkau →</Text>
          </TouchableOpacity>
        )}

        {/* Badge */}
        {slide.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{slide.badge}</Text>
          </View>
        )}

        {/* Emoji Hero */}
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
        </View>

        {/* Decorative circles */}
        <View style={[styles.decorCircle, styles.circle1]} />
        <View style={[styles.decorCircle, styles.circle2]} />
        <View style={[styles.decorCircle, styles.circle3]} />
      </View>

      {/* Bottom White Content */}
      <View style={styles.bottomSection}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        {/* Pagination dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === currentSlide && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>
              {isLast ? 'Mula Sekarang' : 'Seterusnya'}
            </Text>
          </TouchableOpacity>

          {!isLast && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip}>
              <Text style={styles.secondaryButtonText}>Saya Dah Ada Akaun</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    zIndex: 10,
  },
  skipText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 110,
    left: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
  },
  badgeText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  },
  emojiContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  emoji: {
    fontSize: 100,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: Colors.white,
    opacity: 0.3,
  },
  circle1: {
    width: 80,
    height: 80,
    top: 80,
    right: -20,
  },
  circle2: {
    width: 50,
    height: 50,
    bottom: 60,
    left: 20,
  },
  circle3: {
    width: 30,
    height: 30,
    top: 200,
    right: 60,
  },
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },
  dotActive: {
    backgroundColor: Colors.accent,
    width: 24,
  },
  buttons: {
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: 'bold',
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});