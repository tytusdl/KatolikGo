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
    desc: 'Kukuhkan iman Katolik anda melalui aplikasi kuis interaktif yang direka khas untuk komuniti di Malaysia.',
  },
  {
    id: '2',
    icon: 'trophy' as const,
    title: 'Kumpul Pencapaian',
    desc: 'Selesaikan kuiz, kumpul token, dan naikkan tahap anda dalam perjalanan iman.',
  },
  {
    id: '3',
    icon: 'people' as const,
    title: 'Sertai Komuniti',
    desc: 'Beradu dengan rakan-rakan dan daki carta pendahulu paroki anda.',
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
      <View style={styles.brandRow}>
        <Ionicons name="home" size={22} color={Colors.text} />
        <Text style={styles.brand}>KatolikGo</Text>
      </View>

      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>Langkau</Text>
      </TouchableOpacity>

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
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={64} color={Colors.accent} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />

      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.ctaBtn} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.ctaText}>
          {currentIndex === SLIDES.length - 1 ? 'Mula' : 'Seterusnya'}
        </Text>
        <Ionicons name="arrow-forward" size={20} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },

  brandRow: {
    position: 'absolute',
    top: 60,
    left: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  brand: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },

  skipBtn: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    zIndex: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
    textDecorationLine: 'underline',
  },

  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.sm,
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 28,
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.round,
    paddingVertical: 16,
    paddingHorizontal: 36,
    marginBottom: 60,
    minWidth: 220,
  },
  ctaText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },
});
