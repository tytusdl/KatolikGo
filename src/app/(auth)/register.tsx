import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { registerUser } from '@/services/authService';
import { useGoogleAuthRequest, signInWithGoogle, useFacebookAuthRequest, signInWithFacebook } from '@/services/socialAuthService';
import Button from '@/components/Button';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const [googleRequest, googleResponse, googlePromptAsync] = useGoogleAuthRequest();
  const [fbRequest, fbResponse, fbPromptAsync] = useFacebookAuthRequest();

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('Ralat', 'Sila isi semua medan');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Ralat', 'Kata laluan mesti sekurang-kurangnya 6 aksara');
      return;
    }
    setLoading(true);
    try {
      await registerUser(email, password, displayName);
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Gagal Daftar', error.message || 'Pendaftaran gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await googlePromptAsync();
      if (result?.type === 'success' && result.authentication?.idToken) {
        setLoading(true);
        await signInWithGoogle(result.authentication.idToken);
        router.replace('/');
      }
    } catch (error: any) {
      Alert.alert('Gagal', error.message || 'Google login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const result = await fbPromptAsync();
      if (result?.type === 'success' && result.authentication?.accessToken) {
        setLoading(true);
        await signInWithFacebook(result.authentication.accessToken);
        router.replace('/');
      }
    } catch (error: any) {
      Alert.alert('Gagal', error.message || 'Facebook login gagal');
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
        <Text style={styles.title}>Daftar Akaun Baru</Text>

        <TextInput
          style={styles.input}
          placeholder="Nama Penuh"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

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
          placeholder="Kata Laluan (min 6 aksara)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
        />

        <Button title="Daftar" onPress={handleRegister} loading={loading} />

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
          <Text style={styles.socialButtonLabel}>Daftar dengan Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialButton, styles.facebookButton]}
          onPress={handleFacebookLogin}
          disabled={!fbRequest}
        >
          <Text style={[styles.socialButtonText, { color: '#fff' }]}>f</Text>
          <Text style={[styles.socialButtonLabel, { color: '#fff' }]}>Daftar dengan Facebook</Text>
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Sudah ada akaun? </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Log masuk di sini
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  loginText: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  link: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
});
