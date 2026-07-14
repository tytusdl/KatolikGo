import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  type ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: 'book' as const,
    title: 'Selamat Datang',
    desc: 'Terokai iman Katolik melalui kuiz interaktif yang menyeronokkan.',
  },
  {
    id: '2',
    icon: 'trophy' as const,
    title: 'Uji Pengetahuan',
    desc: 'Kumpul XP, token, dan naikkan tahap anda dalam perjalanan iman.',
  },
  {
    id: '3',
    icon: 'people' as const,
    title: 'Sertai Komuniti',
    desc: 'Beradu dengan rakan-rakan dan daki carta pendahulu.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { markOnboarded } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      finish();
    }
  };

  const handleSkip = () => finish();

  const finish = async () => {
    await markOnboarded();
    router.replace(Routes.HOME);
  };

  return (
    <View style={styles.container}>
      {/* Background orbs */}
      <View style={styles.bgPattern} pointerEvents="none">
        <View style={[styles.blurOrb, styles.blurGold]} />
        <View style={[styles.blurOrb, styles.blurNavy]} />
      </View>

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>Langkau</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconHalo} />
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={48} color={Colors.secondary} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.ctaBtn} onPress={handleNext}>
        <Text style={styles.ctaText}>
          {currentIndex === SLIDES.length - 1 ? 'Mula' : 'Seterusnya'}
        </Text>
        <Ionicons name="arrow-forward" size={20} color={Colors.navyDark} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navyDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgPattern: {
    ...StyleSheet.absoluteFillObject,
  },
  blurOrb: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  blurGold: {
    top: 100,
    right: -60,
    backgroundColor: 'rgba(236,194,70,0.15)',
  },
  blurNavy: {
    bottom: 100,
    left: -80,
    backgroundColor: 'rgba(26,58,92,0.4)',
  },

  // Skip
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    zIndex: 10,
  },
  skipText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },

  // Slide
  slide: {
    width,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(236,194,70,0.15)',
    position: 'absolute',
    top: -10,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(14,42,77,0.8)',
    borderWidth: 2,
    borderColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: 40,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.onSurfaceVariant,
    opacity: 0.4,
  },
  dotActive: {
    width: 28,
    backgroundColor: Colors.secondary,
    opacity: 1,
  },

  // CTA
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.round,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 60,
  },
  ctaText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.navyDark,
  },
});
