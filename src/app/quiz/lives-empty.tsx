import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';

export default function LivesEmptyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="heart-dislike" size={48} color={Colors.error} />
        <Text style={styles.title}>Nyawa Habis</Text>
        <Text style={styles.desc}>
          Semua nyawa anda telah digunakan. Tunggu untuk diisi semula atau gunakan token.
        </Text>

        <TouchableOpacity style={styles.tokenBtn} onPress={() => {}} activeOpacity={0.8}>
          <Ionicons name="ribbon" size={20} color={Colors.white} />
          <Text style={styles.tokenBtnText}>Isi dengan 50 Token</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.adBtn} onPress={() => {}} activeOpacity={0.7}>
          <Ionicons name="play-circle" size={20} color={Colors.text} />
          <Text style={styles.adBtnText}>Tonton Iklan (+1 Nyawa)</Text>
        </TouchableOpacity>

        <Text style={styles.waitText}>
          Atau tunggu nyawa diisi semula secara automatik.
        </Text>
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace(Routes.PETA)}>
        <Ionicons name="arrow-back" size={18} color={Colors.textMuted} />
        <Text style={styles.backText}>Kembali ke Peta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.error,
  },
  desc: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  tokenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
  },
  tokenBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },
  adBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
  },
  adBtnText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
  },
  waitText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    paddingVertical: 8,
  },
  backText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
