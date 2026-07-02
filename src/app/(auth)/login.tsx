import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { loginUser } from '@/services/authService';
import {
  useGoogleAuthRequest,
  signInWithGoogle,
  useFacebookAuthRequest,
  signInWithFacebook,
  isFacebookAuthConfigured,
  friendlyAuthError,
} from '@/services/socialAuthService';
import Button from '@/components/Button';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const [googleRequest, , googlePromptAsync] = useGoogleAuthRequest();
  const [fbRequest, , fbPromptAsync] = useFacebookAuthRequest();
  const facebookEnabled = isFacebookAuthConfigured();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ralat', 'Sila isi email dan kata laluan');
      return;
    }
    setLoading(true);
    try {
      // loginUser updates Firebase auth state; AuthGate in _layout.tsx
      // observes that and redirects out of the (auth) group on its own.
      await loginUser(email, password);
    } catch (error) {
      Alert.alert('Gagal Log Masuk', friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const result = await googlePromptAsync();
      if (result?.type === 'success' && result.authentication?.idToken) {
        await signInWithGoogle(result.authentication.idToken);
      }
    } catch (error) {
      Alert.alert('Gagal', friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    if (!facebookEnabled) {
      Alert.alert(
        'Tidak Tersedia',
        'Facebook login belum dikonfigurasikan dalam build ini.'
      );
      return;
    }
    try {
      setLoading(true);
      const result = await fbPromptAsync();
      if (result?.type === 'success' && result.authentication?.accessToken) {
        await signInWithFacebook(result.authentication.accessToken);
      }
    } catch (error) {
      Alert.alert('Gagal', friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>KatolikGo</Text>
        <Text style={styles.title}>Log Masuk ke Akaun Anda</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Kata Laluan"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <Button title="Log Masuk" onPress={handleLogin} loading={loading} />

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>atau</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.socialButton, styles.googleButton]}
          onPress={handleGoogleLogin}
          disabled={!googleRequest}
        >
          <Text style={styles.socialButtonText}>G</Text>
          <Text style={styles.socialButtonLabel}>Log Masuk dengan Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialButton, styles.facebookButton]}
          onPress={handleFacebookLogin}
          disabled={!fbRequest || !facebookEnabled}
        >
          <Text style={[styles.socialButtonText, { color: '#fff' }]}>f</Text>
          <Text style={[styles.socialButtonLabel, { color: '#fff' }]}>Log Masuk dengan Facebook</Text>
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Belum ada akaun? </Text>
          <Link href="/(auth)/register" style={styles.link}>
            Daftar di sini
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: Spacing.md,
    fontSize: FontSize.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    color: Colors.light.textSecondary,
    fontSize: FontSize.sm,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  socialButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: Spacing.sm,
    color: '#4285F4',
  },
  socialButtonLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: '#333',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  registerText: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  link: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
});
