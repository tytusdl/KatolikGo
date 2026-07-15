import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { grantAdminByPassphrase } from '@/admin/adminService';
import { isAdminUnlockConfigured } from '@/config/adminUnlock';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AdminUnlockModal({ visible, onClose }: Props) {
  const { user, refreshUserData } = useAuth();
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAdminUnlockConfigured()) return null;

  const handleUnlock = async () => {
    if (!passphrase.trim() || !user) return;
    setLoading(true);
    try {
      await grantAdminByPassphrase(user, passphrase.trim());
      await refreshUserData();
      Alert.alert('Berjaya', 'Anda kini adalah pentadbir!', [
        { text: 'OK', onPress: onClose },
      ]);
      setPassphrase('');
    } catch (err: any) {
      if (err?.code === 'BAD_PASSPHRASE') {
        Alert.alert('Ralat', 'Kata laluan salah.');
      } else {
        Alert.alert('Ralat', err?.message ?? 'Gagal mengaktifkan pentadbir.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Ionicons name="lock-closed" size={32} color={Colors.accent} />
          <Text style={styles.title}>Admin Access</Text>
          <Text style={styles.desc}>Masukkan kata laluan pentadbir.</Text>

          <TextInput
            style={styles.input}
            placeholder="Kata laluan"
            placeholderTextColor={Colors.textMuted}
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            autoFocus
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleUnlock}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.submitText}>Aktifkan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  desc: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.text,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },
});
