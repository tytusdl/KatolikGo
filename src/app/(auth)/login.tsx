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
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { loginUser, friendlyAuthError } from '@/services/authService';
import { setRememberMe } from '@/utils/rememberMe';
import {
  isGoogleAuthConfigured,
  useGoogleAuthRequest,
  signInWithGoogle,
} from '@/services/socialAuthService';
import { isAdminUnlockConfigured } from '@/config/adminUnlock';
import { Routes } from '@/constants/routes';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [request, , promptAsync] = useGoogleAuthRequest();

  const handleLogin = useCallback(async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password.trim()) {
      Alert.alert('Ralat', 'Sila isi emel dan kata laluan.');
      return;
    }
    setLoading(true);
    try {
      await setRememberMe(rememberMe);
      await loginUser(email.trim(), password);
      router.replace(Routes.HOME);
    } catch (err) {
      Alert.alert('Ralat', friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, password, rememberMe, router]);

  const handleGoogle = useCallback(async () => {
    Keyboard.dismiss();
    if (!request) return;
    try {
      const result = await promptAsync();
      if (result?.type === 'success' && result.authentication?.idToken) {
        await signInWithGoogle(result.authentication.idToken);
        await setRememberMe(true);
        router.replace(Routes.HOME);
      }
    } catch (err) {
      Alert.alert('Ralat', friendlyAuthError(err));
    }
  }, [request, promptAsync, router]);

  const handleForgot = useCallback(() => {
    Alert.alert('Lupa Kata Laluan', 'Sila hubungi sokongan untuk reset kata laluan.');
  }, []);

  if (user && !user.isAnonymous) {
    router.replace(Routes.HOME);
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Log Masuk</Text>
        <Text style={styles.subtitle}>Selamat kembali ke perjalanan iman anda.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email atau Nama Pengguna</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan email anda"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.passwordHeader}>
            <Text style={styles.label}>Kata Laluan</Text>
            <TouchableOpacity onPress={handleForgot}>
              <Text style={styles.forgotLink}>Lupa?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRemember(!rememberMe)}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
            <Text style={styles.rememberText}>Ingat Saya</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Text style={styles.ctaText}>Log Masuk</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.white} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.dividerText}>Atau log masuk dengan</Text>

        <View style={styles.socialRow}>
          {isGoogleAuthConfigured() && (
            <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle} activeOpacity={0.7}>
              <Ionicons name="logo-google" size={20} color={Colors.text} />
              <Text style={styles.socialBtnText}>Google</Text>
            </TouchableOpacity>
          )}
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.socialBtn} onPress={() => {}} activeOpacity={0.7}>
              <Ionicons name="logo-apple" size={22} color={Colors.text} />
              <Text style={styles.socialBtnText}>Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.registerRow}>
          <Text style={styles.registerLabel}>Belum ada akaun? </Text>
          <TouchableOpacity onPress={() => router.push(Routes.REGISTER)}>
            <Text style={styles.registerLink}>Daftar Akaun Baru</Text>
          </TouchableOpacity>
        </View>

        {isAdminUnlockConfigured() && (
          <TouchableOpacity style={styles.adminLink}>
            <Text style={styles.adminText}>🔒 Admin Access</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: 80,
    paddingBottom: 40,
  },

  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
  },

  form: { width: '100%' },
  label: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 14,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  forgotLink: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.accent,
  },
  eyeBtn: { paddingHorizontal: 4 },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  rememberText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },

  dividerText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginVertical: Spacing.lg,
    textAlign: 'center',
    width: '100%',
  },

  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  socialBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },

  registerRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    justifyContent: 'center',
  },
  registerLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  registerLink: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.accent,
    textDecorationLine: 'underline',
  },

  adminLink: { opacity: 0.4, paddingVertical: 8, alignItems: 'center' },
  adminText: { fontSize: FontSize.xs, fontFamily: FontFamily.body, color: Colors.textMuted },
});
