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
import { useAuth } from '@/contexts/AuthContext';
import { loginUser, loginAsGuest, friendlyAuthError } from '@/services/authService';
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

  const handleGuest = useCallback(async () => {
    setLoading(true);
    try {
      await loginAsGuest();
      router.replace(Routes.HOME);
    } catch (err) {
      Alert.alert('Ralat', friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Redirect if already signed in
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
        {/* Background pattern */}
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

        <Text style={styles.title}>Selamat Datang</Text>
        <Text style={styles.subtitle}>Masuk ke KatolikGo</Text>

        {/* Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.label}>Emel</Text>
          <TextInput
            style={styles.input}
            placeholder="contoh@email.com"
            placeholderTextColor={Colors.onSurfaceVariant}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Kata Laluan</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={Colors.onSurfaceVariant}
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
                color={Colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>

          {/* Remember Me */}
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRemember(!rememberMe)}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && <Ionicons name="checkmark" size={14} color={Colors.navyDark} />}
            </View>
            <Text style={styles.rememberText}>Ingat Saya</Text>
          </TouchableOpacity>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.navyDark} />
            ) : (
              <Text style={styles.ctaText}>Log Masuk</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Atau</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Buttons */}
        <View style={styles.socialRow}>
          {isGoogleAuthConfigured() && (
            <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle}>
              <Ionicons name="logo-google" size={22} color="#DB4437" />
            </TouchableOpacity>
          )}
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.socialBtn} onPress={() => {}}>
              <Ionicons name="logo-apple" size={22} color={Colors.onSurface} />
            </TouchableOpacity>
          )}
        </View>

        {/* Guest */}
        <TouchableOpacity style={styles.guestBtn} onPress={handleGuest}>
          <Ionicons name="person-outline" size={18} color={Colors.onSurfaceVariant} />
          <Text style={styles.guestText}>Terus sebagai Tetamu</Text>
        </TouchableOpacity>

        {/* Register Link */}
        <View style={styles.registerRow}>
          <Text style={styles.registerLabel}>Belum ada akaun? </Text>
          <TouchableOpacity onPress={() => router.push(Routes.REGISTER)}>
            <Text style={styles.registerLink}>Daftar</Text>
          </TouchableOpacity>
        </View>

        {/* Admin Access */}
        {isAdminUnlockConfigured() && (
          <TouchableOpacity style={styles.adminLink}>
            <Text style={styles.adminText}>🔐 Admin Access</Text>
          </TouchableOpacity>
        )}
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
    paddingTop: 80,
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
    top: 60,
    right: -40,
    backgroundColor: 'rgba(236,194,70,0.15)',
  },
  blurNavy: {
    bottom: 120,
    left: -60,
    backgroundColor: 'rgba(26,58,92,0.4)',
  },

  // Logo
  logoContainer: {
    marginBottom: Spacing.lg,
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

  // Text
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.xl,
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
    borderColor: Colors.onSurfaceVariant,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  rememberText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },
  ctaBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 16,
    alignItems: 'center',
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

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(236,194,70,0.15)',
  },
  dividerText: {
    marginHorizontal: Spacing.sm,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: Spacing.lg,
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Guest
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.2)',
    marginBottom: Spacing.lg,
  },
  guestText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },

  // Register
  registerRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  registerLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },
  registerLink: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.secondary,
  },

  // Admin
  adminLink: {
    opacity: 0.4,
    paddingVertical: 8,
  },
  adminText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },
});
