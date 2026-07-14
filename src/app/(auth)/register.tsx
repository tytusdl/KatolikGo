import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  registerUser,
  friendlyAuthError,
  validateUsername,
  USERNAME_MIN,
  USERNAME_MAX,
} from '@/services/authService';
import { Routes } from '@/constants/routes';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = useCallback(async () => {
    if (!name.trim() || !username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Ralat', 'Sila isi semua medan.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Ralat', 'Kata laluan tidak sepadan.');
      return;
    }
    const usernameResult = validateUsername(username.trim());
    if (!usernameResult.valid) {
      Alert.alert('Ralat', usernameResult.error);
      return;
    }
    setLoading(true);
    try {
      await registerUser(email.trim(), password, name.trim(), usernameResult.normalized);
      router.replace(Routes.HOME);
    } catch (err) {
      Alert.alert('Ralat', friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [name, username, email, password, confirm, router]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Background orbs */}
        <View style={styles.bgPattern} pointerEvents="none">
          <View style={[styles.blurOrb, styles.blurGold]} />
          <View style={[styles.blurOrb, styles.blurNavy]} />
        </View>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoHalo} />
          <View style={styles.logoCircle}>
            <Ionicons name="book" size={36} color={Colors.secondary} />
          </View>
        </View>

        <Text style={styles.title}>Daftar Akaun Baru</Text>
        <Text style={styles.subtitle}>Sertai komuniti KatolikGo</Text>

        {/* Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.label}>Nama Penuh</Text>
          <TextInput
            style={styles.input}
            placeholder="Nama anda"
            placeholderTextColor={Colors.onSurfaceVariant}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Nama Pengguna</Text>
          <TextInput
            style={styles.input}
            placeholder={`${USERNAME_MIN}-${USERNAME_MAX} aksara`}
            placeholderTextColor={Colors.onSurfaceVariant}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Emel</Text>
          <TextInput
            style={styles.input}
            placeholder="contoh@email.com"
            placeholderTextColor={Colors.onSurfaceVariant}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Kata Laluan</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Minimum 6 aksara"
              placeholderTextColor={Colors.onSurfaceVariant}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Sahkan Kata Laluan</Text>
          <TextInput
            style={styles.input}
            placeholder="Ulang kata laluan"
            placeholderTextColor={Colors.onSurfaceVariant}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPassword}
          />

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.navyDark} />
            ) : (
              <Text style={styles.ctaText}>Daftar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginLabel}>Sudah ada akaun? </Text>
          <TouchableOpacity onPress={() => router.push(Routes.LOGIN)}>
            <Text style={styles.loginLink}>Log Masuk</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>✝ Tuhan memberkati hari anda</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: Colors.navyDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  bgPattern: {
    ...StyleSheet.absoluteFillObject,
  },
  blurOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  blurGold: {
    top: 40,
    left: -40,
    backgroundColor: 'rgba(236,194,70,0.15)',
  },
  blurNavy: {
    bottom: 80,
    right: -60,
    backgroundColor: 'rgba(26,58,92,0.4)',
  },

  // Logo
  logoContainer: {
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  logoHalo: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(236,194,70,0.2)',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(14,42,77,0.8)',
    borderWidth: 2,
    borderColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.lg,
  },

  // Form Card
  formCard: {
    width: '100%',
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.15)',
    padding: Spacing.lg,
  },
  label: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(18,20,17,0.6)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.creamSoft,
    marginBottom: Spacing.md,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18,20,17,0.6)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.1)',
    marginBottom: Spacing.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.creamSoft,
  },
  eyeBtn: {
    paddingHorizontal: Spacing.md,
  },
  ctaBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.navyDark,
  },

  // Login Link
  loginRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
  loginLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },
  loginLink: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.secondary,
  },

  // Footer
  footer: {
    marginTop: Spacing.xl,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    fontStyle: 'italic',
    color: Colors.onSurfaceVariant,
    opacity: 0.5,
  },
});
