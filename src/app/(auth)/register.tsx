import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { registerUser } from '@/services/authService';
import Button from '@/components/Button';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Text style={styles.logo}>✝️ KatolikGo</Text>
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

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Sudah ada akaun? </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Log masuk di sini
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    justifyContent: 'center',
  },
  content: {
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