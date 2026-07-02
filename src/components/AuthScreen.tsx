import { useEffect, useState } from 'react';
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
} from '@/services/authService';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    'google' | 'apple' | 'guest' | null
  >(null);

  const [googleRequest, , googlePromptAsync] = useGoogleAuthRequest();

  // Safety net mirroring the old login.tsx/register.tsx — AuthGate in
  // _layout.tsx is the canonical redirect, but if for any reason it
  // misses the post-login flip while this screen is mounted, fall back
  // to an explicit replace. Same target as AuthGate, so no race.
  useEffect(() => {
    if (user) router.replace('/(tabs)/index');
  }, [user, router]);

  const isRegister = tab === 'register';

  const handleSubmit = async () => {
    if (!email || !password || (isRegister && !displayName)) {
      Alert.alert(
        'Ralat',
        isRegister
          ? 'Sila isi semua medan.'
          : 'Sila isi emel dan kata laluan.'
      );
      return;
    }
    if (isRegister && password.length < 6) {
      Alert.alert('Ralat', 'Kata laluan mesti sekurang-kurangnya 6 aksara.');
      return;
    }
    setSubmitting(true);
    try {
      if (isRegister) {
        await registerUser(email, password, displayName.trim());
      } else {
        await loginUser(email, password);
      }
      // AuthGate observes the Firebase auth flip and redirects.
    } catch (error) {
      console.warn(`[auth] ${tab} failed`, error);
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
    } catch (error) {
      Alert.alert('Gagal', friendlyAuthError(error));
    } finally {
      setSocialLoading(null);
    }
  };

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
            )}

            <View style={styles.field}>
              <Text style={styles.label}>E-MEL</Text>
              <TextInput
                style={styles.input}
                placeholder="contoh@emel.com"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
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
        </ScrollView>
      </LinearGradient>
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
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.md,
    color: Colors.white,
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
});