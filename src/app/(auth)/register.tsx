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
    Keyboard.dismiss();
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
        <Text style={styles.title}>Daftar Akaun Baru</Text>
        <Text style={styles.subtitle}>Sertai komuniti KatolikGo</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Nama Penuh</Text>
          <TextInput
            style={styles.input}
            placeholder="Nama anda"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Nama Pengguna</Text>
          <TextInput
            style={styles.input}
            placeholder={`${USERNAME_MIN}-${USERNAME_MAX} aksara`}
            placeholderTextColor={Colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="contoh@email.com"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Kata Laluan</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Minimum 6 aksara"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Sahkan Kata Laluan</Text>
          <TextInput
            style={styles.input}
            placeholder="Ulang kata laluan"
            placeholderTextColor={Colors.textMuted}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPassword}
          />

          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Text style={styles.ctaText}>Daftar</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.white} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginLabel}>Sudah ada akaun? </Text>
          <TouchableOpacity onPress={() => router.push(Routes.LOGIN)}>
            <Text style={styles.loginLink}>Log Masuk</Text>
          </TouchableOpacity>
        </View>
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
  eyeBtn: { paddingHorizontal: 4 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    marginTop: Spacing.sm,
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },

  loginRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    justifyContent: 'center',
  },
  loginLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  loginLink: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
});
