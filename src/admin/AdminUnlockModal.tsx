import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { User as FirebaseUser } from 'firebase/auth';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import {
  grantAdminByPassphrase,
  BAD_PASSPHRASE,
} from '@/admin/adminService';

/**
 * Shared admin-unlock modal — used by both `AuthScreen` (small
 * text-link trigger) and `Profile` tab (full menu-item trigger).
 * Same UX and same dark theme so the trigger feel matches across
 * surfaces, and the bundled passphrase / Firestore writes only
 * happen in one place.
 *
 * Caller is responsible for:
 *   - Showing the trigger
 *   - Owning `visible` state
 *   - Forwarding `user` so the service knows which doc to flip
 *
 * On success, prompts the user to jump to `/admin` (can be
 * overridden via `onSuccess`).
 *
 * Modal is "dumb" — it doesn't read the env or know whether the
 * feature is configured. The trigger surfaces should hide
 * themselves when `isAdminUnlockConfigured()` returns false, so
 * this modal only renders in the configured case.
 */
interface AdminUnlockModalProps {
  visible: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  /**
   * Override the default post-success action ("Buka Panel"). Default
   * navigates to `/admin`. Pass a custom handler if e.g. you need to
   * pop a parent modal first.
   */
  onSuccess?: () => void;
}

export function AdminUnlockModal({
  visible,
  onClose,
  user,
  onSuccess,
}: AdminUnlockModalProps) {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    if (busy) return;
    setPassphrase('');
    onClose();
  }, [busy, onClose]);

  const submit = useCallback(async () => {
    if (!passphrase.trim()) {
      Alert.alert('Frasa laluan kosong', 'Sila masukkan frasa laluan.');
      return;
    }
    setBusy(true);
    try {
      await grantAdminByPassphrase(user, passphrase);
      setPassphrase('');
      onClose();
      Alert.alert(
        'Akses admin diaktifkan',
        'Anda kini boleh akses Panel Pentadbir.',
        [
          {
            text: 'Buka Panel',
            onPress: () => {
              if (onSuccess) onSuccess();
              else router.replace(Routes.ADMIN);
            },
          },
          { text: 'Tutup', style: 'cancel' },
        ]
      );
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const fallbackMsg =
        (error as Error)?.message ?? 'Frasa laluan admin salah.';
      Alert.alert(
        'Tidak berjaya',
        code === BAD_PASSPHRASE ? 'Frasa laluan admin salah.' : fallbackMsg
      );
    } finally {
      setBusy(false);
    }
  }, [user, passphrase, onClose, onSuccess, router]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        {/* Inner Pressable swallows taps so backdrop-press doesn't
            dismiss when the user taps inside the card. Standard RN
            pattern for tap-outside-to-dismiss without a third-party
            Modal lib. */}
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={Colors.accent}
            />
            <Text style={styles.title}>Akses Pentadbir</Text>
          </View>
          <Text style={styles.sub}>
            Masukkan frasa laluan admin untuk membuka akses panel
            pentadbir pada akaun semasa.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Frasa laluan"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => {
              void submit();
            }}
          />
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btn, styles.btnCancel]}
              onPress={close}
              disabled={busy}
              hitSlop={6}
            >
              <Text style={styles.btnCancelText}>Batal</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnSubmit,
                busy && styles.disabled,
              ]}
              onPress={() => {
                void submit();
              }}
              disabled={busy}
              hitSlop={6}
            >
              {busy ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.btnSubmitText}>Aktifkan</Text>
              )}
            </Pressable>
          </View>
          {!user && (
            <Text style={styles.hint}>
              Anda belum log masuk. Daftar atau log masuk dulu, kemudian
              tekan Admin Access semula.
            </Text>
          )}
          {user?.isAnonymous && (
            <Text style={styles.hint}>
              Akaun tetamu tidak boleh menjadi admin. Sila daftar akaun
              penuh dulu.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,24,45,0.78)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  sub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.sm,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.white,
    marginBottom: Spacing.md,
    letterSpacing: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnSubmit: {
    backgroundColor: Colors.accent,
  },
  btnCancelText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  btnSubmitText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: FontSize.sm,
    letterSpacing: 0.4,
  },
  disabled: {
    opacity: 0.55,
  },
  hint: {
    marginTop: Spacing.sm,
    color: 'rgba(255,255,255,0.55)',
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
