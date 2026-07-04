import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useGoogleAuthRequest,
  signInWithGoogle,
  signInWithApple,
} from '@/services/socialAuthService';
import {
  loginUser,
  registerUser,
  loginAsGuest,
  friendlyAuthError,
  UsernameTakenError,
  validateUsername,
} from '@/services/authService';
import { setRememberMe as persistRememberMe } from '@/utils/rememberMe';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminUnlockConfigured } from '@/config/adminUnlock';
import { AdminUnlockModal } from '@/admin/AdminUnlockModal';

type Tab = 'login' | 'register';

interface AuthScreenProps {
  /**
   * Which tab the screen opens on. `login.tsx` passes `'login'`,
   * `register.tsx` passes `'register'` so deep links to `/register`
   * still land the user on the register form. Tabs can be flipped
   * after mount via internal state.
   */
  defaultTab?: Tab;
}

/**
 * Shared dark-themed authentication screen used by both
 * `app/(auth)/login.tsx` and `app/(auth)/register.tsx`.
 *
 * Two routes still exist so deep links and the AuthGate path checks
 * (`pathname === '/login' || '/register'`) keep working, but the
 * rendered UI is identical. A pill tab at the top lets the user
 * flip between Log Masuk / Daftar without navigating away — the
 * form fields stay in sync, so swapping tabs doesn't clear what the
 * user already typed.
 *
 * Why dark: matches the branded splash and the rest of the onboarding
 * visuals, gives the gold accent on the cross + the maroon CTA enough
 * contrast to feel intentional rather than default-y.
 */
export default function AuthScreen({ defaultTab = 'login' }: AuthScreenProps) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // "Remember Me" only applies to the login flow. Default true so
  // existing users keep their persistent session; unchecking writes
  // `false` to AsyncStorage after a successful sign-in and the
  // AuthContext restores-by-then-signs-out the next cold start.
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    'google' | 'apple' | 'guest' | null
  >(null);

  // Admin unlock — surfaced only when EXPO_PUBLIC_ADMIN_PASSPHRASE
  // is set in the build env. When unset the entry point hides
  // entirely; we don't want a non-functional button visible to
  // end users. The modal is shared with the Profile tab — see
  // `src/admin/AdminUnlockModal.tsx`.
  const adminUnlockAvailable = isAdminUnlockConfigured();
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const [googleRequest, , googlePromptAsync] = useGoogleAuthRequest();

  // Safety net mirroring AuthGate in `_layout.tsx` — that gate is the
  // canonical redirect, but if for any reason it misses the post-login
  // flip while this screen is mounted, fall back to an explicit replace.
  // Same target as AuthGate, so no race.
  //
  // Anonymous ("Tetamu") users are excluded from this redirect so they
  // can reach /login or /register to convert — Firebase anonymous users
  // are real User objects, so a plain `if (user)` check would yank
  // them back to home before they ever see the form.
  useEffect(() => {
    if (user && !user.isAnonymous) {
      router.replace('/(tabs)/index');
    }
  }, [user, router]);

  const isRegister = tab === 'register';

  const handleSubmit = async () => {
    if (!email || !password || (isRegister && (!displayName || !username))) {
      Alert.alert(
        'Ralat',
        isRegister
          ? 'Sila isi semua medan.'
          : 'Sila isi emel (atau nama pengguna) dan kata laluan.'
      );
      return;
    }
    if (isRegister && password.length < 6) {
      Alert.alert('Ralat', 'Kata laluan mesti sekurang-kurangnya 6 aksara.');
      return;
    }
    if (isRegister) {
      // Validate before hitting the network — keeps the round-trip
      // pattern-matching-friendly for the user and surfaces a precise
      // Malay message instead of the generic "Gagal Daftar".
      const usernameCheck = validateUsername(username);
      if (!usernameCheck.valid) {
        Alert.alert('Nama Pengguna', usernameCheck.error);
        return;
      }
    }
    setSubmitting(true);
    try {
      if (isRegister) {
        await registerUser(
          email.trim(),
          password,
          displayName.trim(),
          username.trim()
        );
      } else {
        await loginUser(email.trim(), password);
        // Persist the "Remember Me" choice so cold-start can honor it.
        // Only meaningful on the login flow — register always implies
        // "yes, remember me" because the user explicitly opted in by
        // creating an account on this device.
        await persistRememberMe(rememberMe);
      }
      // AuthGate observes the Firebase auth flip and redirects.
    } catch (error) {
      console.warn(`[auth] ${tab} failed`, error);
      // Surface the username-taken case specifically — the generic
      // AuthError mapping wouldn't know to escalate this one.
      if (error instanceof UsernameTakenError) {
        Alert.alert('Nama Pengguna', error.message);
        return;
      }
      Alert.alert(
        isRegister ? 'Gagal Daftar' : 'Gagal Log Masuk',
        friendlyAuthError(error)
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (socialLoading) return;
    setSocialLoading('google');
    try {
      const result = await googlePromptAsync();
      if (result?.type === 'success' && result.authentication?.idToken) {
        await signInWithGoogle(result.authentication.idToken);
      }
    } catch (error) {
      Alert.alert('Gagal', friendlyAuthError(error));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleApple = async () => {
    if (socialLoading) return;
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Tidak Tersedia',
        'Apple Sign-In hanya tersedia pada peranti iOS.'
      );
      return;
    }
    setSocialLoading('apple');
    try {
      await signInWithApple();
    } catch (error) {
      // expo-apple-authentication throws ERR_CANCELED when the user
      // dismisses the system sheet. We don't want to scream "Gagal"
      // at someone who intentionally cancelled.
      const code = (error as { code?: string })?.code;
      const message = (error as Error)?.message ?? '';
      if (
        code === 'ERR_CANCELED' ||
        code === 'ERR_REQUEST_CANCELED' ||
        /cancel/i.test(message)
      ) {
        return;
      }
      Alert.alert('Gagal', friendlyAuthError(error));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGuest = async () => {
    if (socialLoading) return;
    setSocialLoading('guest');
    try {
      await loginAsGuest();
      // AuthGate's `if (user.isAnonymous) return` branch intentionally
      // lets anon ("Tetamu") users roam /login and /register so they
      // can convert via the GuestModeBanner — that same branch means
      // AuthGate doesn't auto-redirect us home after `signInAnonymously`
      // resolves. So we navigate explicitly here. (Email/password
      // flows in `handleSubmit` are handled by AuthGate's justGotUser
      // branch + the registered-kick below; only the guest path needs
      // this targeted exception.)
      router.replace('/(tabs)/index');
    } catch (error) {
      Alert.alert('Gagal', friendlyAuthError(error));
    } finally {
      setSocialLoading(null);
    }
  };

  const openAdminModal = useCallback(() => {
    setAdminModalOpen(true);
  }, []);

  const closeAdminModal = useCallback(() => {
    setAdminModalOpen(false);
  }, []);

  const anyLoading = submitting || socialLoading !== null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* The root layout sets dark-content for the light (tabs) screens.
          Auth is dark, so override locally — last-mounted StatusBar wins. */}
      <StatusBar barStyle="light-content" backgroundColor="#0e2a4d" />
      <LinearGradient
        colors={['#0e2a4d', '#08182d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Gold cross — the visual anchor of the brand */}
          <View style={styles.crossWrapper}>
            <FontAwesome5 name="cross" size={42} color={Colors.accent} />
          </View>

          <Text style={styles.title}>Selamat Datang</Text>
          <Text style={styles.tagline}>Dalami iman melalui permainan</Text>

          {/* Log Masuk / Daftar pill switcher */}
          <View style={styles.tabsRow}>
            <Pressable
              style={[styles.tab, !isRegister && styles.tabActive]}
              onPress={() => setTab('login')}
              android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            >
              <Text
                style={[styles.tabText, !isRegister && styles.tabTextActive]}
              >
                Log Masuk
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, isRegister && styles.tabActive]}
              onPress={() => setTab('register')}
              android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            >
              <Text
                style={[styles.tabText, isRegister && styles.tabTextActive]}
              >
                Daftar
              </Text>
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {isRegister && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>NAMA PENUH</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nama anda"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>NAMA PENGGUNA</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="mikael.b (3-20 aksara)"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                  />
                  <Text style={styles.fieldHint}>
                    Huruf pertama mestilah huruf. Hanya huruf, nombor, titik, underscore.
                  </Text>
                </View>
              </>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>
                {isRegister ? 'E-MEL' : 'E-MEL ATAU NAMA PENGGUNA'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={
                  isRegister
                    ? 'contoh@emel.com'
                    : 'contoh@emel.com atau nama pengguna'
                }
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={email}
                onChangeText={setEmail}
                keyboardType={isRegister ? 'email-address' : 'default'}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isRegister ? 'email' : 'username'}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>KATA LALUAN</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder={
                    isRegister ? 'Minimum 6 aksara' : 'Masukkan kata laluan'
                  }
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete={isRegister ? 'password-new' : 'password'}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(s => !s)}
                  hitSlop={10}
                  android_ripple={{ color: 'transparent' }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="rgba(255,255,255,0.6)"
                  />
                </Pressable>
              </View>
            </View>

            {/* Remember Me — login only. Default checked so existing
                users keep their persistent session; unchecking writes
                `false` to AsyncStorage after sign-in and the next cold
                start signs them out. */}
            {!isRegister && (
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberMe(v => !v)}
                hitSlop={8}
                android_ripple={{ color: 'transparent' }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View
                  style={[
                    styles.rememberCheckbox,
                    rememberMe && styles.rememberCheckboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={14} color="#0e2a4d" />
                  )}
                </View>
                <Text style={styles.rememberLabel}>
                  Ingat saya (kekal log masuk selepas tutup aplikasi)
                </Text>
              </Pressable>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, anyLoading && styles.disabled]}
            onPress={handleSubmit}
            disabled={anyLoading}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitText}>
                {isRegister ? 'Daftar' : 'Log Masuk'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>atau</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={[styles.socialButton, socialLoading !== null && styles.disabled]}
              onPress={handleGoogle}
              disabled={!googleRequest || socialLoading !== null}
              activeOpacity={0.85}
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <FontAwesome5 name="google" size={18} color="#EA4335" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </>
              )}
            </TouchableOpacity>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialButton, socialLoading !== null && styles.disabled]}
                onPress={handleApple}
                disabled={socialLoading !== null}
                activeOpacity={0.85}
              >
                {socialLoading === 'apple' ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <FontAwesome5 name="apple" size={20} color={Colors.white} />
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Guest */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuest}
            disabled={socialLoading !== null}
            activeOpacity={0.7}
          >
            {socialLoading === 'guest' ? (
              <ActivityIndicator color="rgba(255,255,255,0.75)" size="small" />
            ) : (
              <>
                <Ionicons
                  name="person-circle-outline"
                  size={18}
                  color="rgba(255,255,255,0.75)"
                />
                <Text style={styles.guestText}>Terus sebagai Tetamu</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Developer-only "Admin Access" — surfaces only when the
              passphrase env var is configured. Visually muted so
              normal users don't fixate on it; the dev knows it's
              there. Tap opens a modal that asks for the passphrase
              and grants `isAdmin: true` on the current user doc. */}
          {adminUnlockAvailable && (
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={openAdminModal}
              activeOpacity={0.6}
            >
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.adminBtnText}>Admin Access</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </LinearGradient>

      {/* Admin unlock modal — extracted to `@/admin/AdminUnlockModal`
          so the same component is reachable from the Profile tab.
          Caller (this screen) only owns visibility + user ref. */}
      <AdminUnlockModal
        visible={adminModalOpen}
        onClose={closeAdminModal}
        user={user}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08182d',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  crossWrapper: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  tabTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  form: {
    marginBottom: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginBottom: Spacing.xs + 2,
  },
  fieldHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 6,
    lineHeight: 14,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.md,
    color: Colors.white,
  },

  // Remember Me row (login only)
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  rememberCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rememberCheckboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  rememberLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.sm,
    fontWeight: '500',
    flex: 1,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
  },
  passwordInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  eyeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  submitButton: {
    backgroundColor: '#b9444a',
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  submitText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.55,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: FontSize.sm,
    marginHorizontal: Spacing.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    minHeight: 50,
  },
  socialButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  guestText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.sm,
    fontWeight: '500',
  },

  // ---- Admin Access entry point (button only — modal lives in
  // `@/admin/AdminUnlockModal`) ----
  // Intentionally small + muted so it doesn't fight with the
  // primary CTAs (Log Masuk, Google, Guest). The dev knows it's
  // there; end users shouldn't fixate on it.
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: Spacing.md,
  },
  adminBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.6,
    textDecorationLine: 'underline',
  },
});