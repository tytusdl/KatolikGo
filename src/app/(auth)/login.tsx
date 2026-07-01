import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { loginUser } from '@/services/authService';
import Button from '@/components/Button';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ralat', 'Sila isi email dan kata laluan');
      return;
    }

    setLoading(true);
    try {
      await loginUser(email, password);
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Gagal Log Masuk', error.message || 'Log masuk gagal');
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
