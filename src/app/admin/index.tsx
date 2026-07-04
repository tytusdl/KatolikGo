import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  assertAdmin,
  grantTokens,
  setTokens,
  grantXp,
  setXp,
  setCurrentLevel,
  refillLives,
  setLives,
  clearLivesCooldowns,
  setPremium,
  setOwnAdmin,
  fetchSnapshot,
  NOT_ADMIN,
} from '@/admin/adminService';
import { LIVES_CONFIG } from '@/constants/xp.constants';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

/**
 * Developer admin panel — only renders meaningfully for users with
 * `isAdmin === true` on their Firestore doc. Promote via the CLI:
 *
 *   node scripts/admin.mjs grant-admin <your-uid>
 *
 * The panel is single-tenant (acts on the admin's own account).
 * Strictly a developer tool — excluded from the (tabs) navigation,
 * gated both in routing (render-time assertAdmin redirect) and in
 * every service call (`assertAdmin(caller)` guard).
 *
 * Sections:
 *   - Token  (grant / set)
 *   - XP     (grant across all 3 counters / set per counter)
 *   - Level  (set currentLevel)
 *   - Nyawa  (refill / set / clear cooldowns)
 *   - Akaun  (toggle isPremium, remove own isAdmin)
 *   - Refresh
 */
export default function AdminScreen() {
  const { userData, refreshUserData } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{
    title: string;
    label: string;
    placeholder: string;
    submitLabel: string;
    onSubmit: (n: number) => Promise<void> | void;
  } | null>(null);
  const [modalInput, setModalInput] = useState('');

  const closeModal = useCallback(() => {
    setModal(null);
    setModalInput('');
  }, []);

  const showCustomModal = useCallback((cfg: NonNullable<typeof modal>) => {
    setModal(cfg);
    setModalInput('');
  }, []);

  // Core runner — wraps any admin service call with consistent UX:
  // busy veil + Alert surface + post-action server refresh.
  // Catches `NOT_ADMIN` and surfaces the friendlier "Akses admin
  // diperlukan" wording. All other errors fall through to the
  // raw service message (services already localise their throws).
  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      if (!userData) {
        Alert.alert('Ralat', 'Sila log masuk.');
        return;
      }
      assertAdmin(userData);
      setBusy(true);
      try {
        await fn();
        await refreshUserData();
      } catch (err) {
        const code = (err as { code?: string })?.code;
        const msg =
          code === NOT_ADMIN
            ? 'Akses admin diperlukan. Pastikan akaun anda isAdmin=true.'
            : (err as Error)?.message ?? 'Ralat tidak dijangka.';
        Alert.alert('Tidak berjaya: ' + label, msg);
      } finally {
        setBusy(false);
      }
    },
    [userData, refreshUserData]
  );

  // Gating — render-time redirect for non-admins. The service-layer
  // guard catches accidental leaks; this catches the screen-entry path.
  if (userData && !userData.isAdmin) {
    return (
      <View style={[styles.container, styles.gateContainer, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.gateIcon}>🚫</Text>
        <Text style={styles.gateTitle}>Akses Pentadbir Diperlukan</Text>
        <Text style={styles.gateBody}>
          Akaun anda tiada kebenaran untuk membuka panel ini.
        </Text>
        <TouchableOpacity style={styles.gateBtn} onPress={() => router.back()}>
          <Text style={styles.gateBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!userData) {
    return (
      <View style={[styles.container, styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Panel Pentadbir</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Identity banner */}
        <View style={styles.identityCard}>
          <Text style={styles.identityLabel}>LOG MASUK SEBAGAI</Text>
          <Text style={styles.identityName}>
            {userData.displayName || 'Saudara'}
          </Text>
          <Text style={styles.identityUid} numberOfLines={1}>
            {userData.email || userData.uid}
          </Text>
          <View style={styles.identityBadgeRow}>
            <View style={styles.identityBadgeAdmin}>
              <Text style={styles.identityBadgeAdminText}>ADMIN ✓</Text>
            </View>
          </View>
        </View>

        {/* ============ TOKEN ============ */}
        <Section title="🪙 Token" subtitle="Urus baki token anda">
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>Semasa:</Text>
            <Text style={styles.valueBig}>{userData.tokens ?? 0}</Text>
          </View>
          <BtnRow>
            <SmallBtn
              label="+50"
              onPress={() => run('+50 token', () => grantTokens(userData, 50))}
            />
            <SmallBtn
              label="+100"
              onPress={() => run('+100 token', () => grantTokens(userData, 100))}
            />
            <SmallBtn
              label="+500"
              onPress={() => run('+500 token', () => grantTokens(userData, 500))}
            />
            <SmallBtn
              label="-50"
              danger
              onPress={() => run('-50 token', () => grantTokens(userData, -50))}
            />
          </BtnRow>
          <BtnRow>
            <SmallBtn
              label="Tambah Custom…"
              primary
              onPress={() =>
                showCustomModal({
                  title: 'Tambah Token (Delta)',
                  label: 'Jumlah (boleh negatif)',
                  placeholder: 'contoh: 250',
                  submitLabel: 'Tambah',
                  onSubmit: (n) => run('tambah token', () => grantTokens(userData, n)),
                })
              }
            />
            <SmallBtn
              label="Set Custom…"
              onPress={() =>
                showCustomModal({
                  title: 'Set Token (Replace)',
                  label: 'Nilai baru',
                  placeholder: 'contoh: 1000',
                  submitLabel: 'Set',
                  onSubmit: (n) => run('set token', () => setTokens(userData, n)),
                })
              }
            />
          </BtnRow>
        </Section>

        {/* ============ XP ============ */}
        <Section title="⭐ XP" subtitle="Tambah atau set XP untuk semua counter">
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>Jumlah:</Text>
            <Text style={styles.valueBig}>{userData.totalXP ?? 0}</Text>
          </View>
          <View style={styles.xpSubRow}>
            <Text style={styles.xpSubLabel}>Mingguan</Text>
            <Text style={styles.xpSubValue}>{userData.weeklyXP ?? 0}</Text>
          </View>
          <View style={styles.xpSubRow}>
            <Text style={styles.xpSubLabel}>Bulanan</Text>
            <Text style={styles.xpSubValue}>{userData.monthlyXP ?? 0}</Text>
          </View>
          <BtnRow>
            <SmallBtn
              label="+500"
              onPress={() => run('+500 XP', () => grantXp(userData, 500))}
            />
            <SmallBtn
              label="+2000"
              onPress={() => run('+2000 XP', () => grantXp(userData, 2000))}
            />
            <SmallBtn
              label="+10K"
              onPress={() => run('+10K XP', () => grantXp(userData, 10000))}
            />
            <SmallBtn
              label="-1000"
              danger
              onPress={() => run('-1000 XP', () => grantXp(userData, -1000))}
            />
          </BtnRow>
          <BtnRow>
            <SmallBtn
              label="Tambah Custom…"
              primary
              onPress={() =>
                showCustomModal({
                  title: 'Tambah XP (Semua counter)',
                  label: 'Jumlah (boleh negatif)',
                  placeholder: 'contoh: 1500',
                  submitLabel: 'Tambah',
                  onSubmit: (n) => run('tambah XP', () => grantXp(userData, n)),
                })
              }
            />
          </BtnRow>
          <BtnRow>
            <SmallBtn
              label="Set Total…"
              onPress={() =>
                showCustomModal({
                  title: 'Set Total XP (Replace)',
                  label: 'Nilai baru',
                  placeholder: 'contoh: 5000',
                  submitLabel: 'Set',
                  onSubmit: (n) =>
                    run('set totalXP', () =>
                      setXp(userData, n, userData.weeklyXP ?? 0, userData.monthlyXP ?? 0)
                    ),
                })
              }
            />
            <SmallBtn
              label="Set Mingguan…"
              onPress={() =>
                showCustomModal({
                  title: 'Set Weekly XP',
                  label: 'Nilai baru',
                  placeholder: 'contoh: 500',
                  submitLabel: 'Set',
                  onSubmit: (n) =>
                    run('set weeklyXP', () =>
                      setXp(
                        userData,
                        userData.totalXP ?? 0,
                        n,
                        userData.monthlyXP ?? 0
                      )
                    ),
                })
              }
            />
            <SmallBtn
              label="Set Bulanan…"
              onPress={() =>
                showCustomModal({
                  title: 'Set Monthly XP',
                  label: 'Nilai baru',
                  placeholder: 'contoh: 1200',
                  submitLabel: 'Set',
                  onSubmit: (n) =>
                    run('set monthlyXP', () =>
                      setXp(
                        userData,
                        userData.totalXP ?? 0,
                        userData.weeklyXP ?? 0,
                        n
                      )
                    ),
                })
              }
            />
          </BtnRow>
        </Section>

        {/* ============ LEVEL ============ */}
        <Section title="🏆 Level" subtitle="Tetapkan level akses">
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>Sekarang:</Text>
            <Text style={styles.valueBig}>{userData.currentLevel ?? 1}</Text>
          </View>
          <BtnRow>
            <SmallBtn
              label="+1"
              onPress={() =>
                run('+1 level', () =>
                  setCurrentLevel(userData, (userData.currentLevel ?? 1) + 1)
                )
              }
            />
            <SmallBtn
              label="+5"
              onPress={() =>
                run('+5 level', () =>
                  setCurrentLevel(userData, (userData.currentLevel ?? 1) + 5)
                )
              }
            />
            <SmallBtn
              label="-5"
              danger
              onPress={() =>
                run('-5 level', () =>
                  setCurrentLevel(
                    userData,
                    Math.max(1, (userData.currentLevel ?? 1) - 5)
                  )
                )
              }
            />
            <SmallBtn
              label="Reset 1"
              danger
              onPress={() => run('reset level', () => setCurrentLevel(userData, 1))}
            />
          </BtnRow>
          <BtnRow>
            <SmallBtn
              label="Set Custom…"
              primary
              onPress={() =>
                showCustomModal({
                  title: 'Set Level Akses',
                  label: 'Nilai baru (1–100)',
                  placeholder: 'contoh: 25',
                  submitLabel: 'Set',
                  onSubmit: (n) => run('set level', () => setCurrentLevel(userData, n)),
                })
              }
            />
          </BtnRow>
        </Section>

        {/* ============ LIVES ============ */}
        <Section title="❤️ Nyawa" subtitle="Isi semula atau ubah nilai nyawa">
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>Sekarang:</Text>
            <Text style={styles.valueBig}>
              {userData.lives ?? LIVES_CONFIG.MAX} / {LIVES_CONFIG.MAX}
            </Text>
          </View>
          <View style={styles.xpSubRow}>
            <Text style={styles.xpSubLabel}>Lives anchor</Text>
            <Text style={styles.xpSubValue}>
              {userData.livesLastLostAt ? 'aktif' : '(tiada)'}
            </Text>
          </View>
          <View style={styles.xpSubRow}>
            <Text style={styles.xpSubLabel}>Ad cooldown</Text>
            <Text style={styles.xpSubValue}>
              {userData.lastAdRefillAt ? 'aktif' : '(tiada)'}
            </Text>
          </View>
          <BtnRow>
            <SmallBtn
              label="Isi Penuh"
              primary
              onPress={() => run('isi semula nyawa', () => refillLives(userData))}
            />
            <SmallBtn
              label="Set Custom…"
              onPress={() =>
                showCustomModal({
                  title: 'Set Nyawa',
                  label: `Nilai baru (0–${LIVES_CONFIG.MAX})`,
                  placeholder: `contoh: ${LIVES_CONFIG.MAX}`,
                  submitLabel: 'Set',
                  onSubmit: (n) => run('set nyawa', () => setLives(userData, n)),
                })
              }
            />
          </BtnRow>
          <BtnRow>
            <SmallBtn
              label="Buang Cooldown"
              onPress={() =>
                run('buang cooldown nyawa', () => clearLivesCooldowns(userData))
              }
            />
          </BtnRow>
        </Section>

        {/* ============ ACCOUNT ============ */}
        <Section title="👑 Akaun" subtitle="Tukar status akaun">
          <View style={styles.xpSubRow}>
            <Text style={styles.xpSubLabel}>Status</Text>
            <Text style={styles.xpSubValue}>
              {userData.isPremium ? 'PRO' : 'Biasa'}
            </Text>
          </View>
          <BtnRow>
            <SmallBtn
              label={userData.isPremium ? 'Turun ke Biasa' : 'Naik Taraf ke PRO'}
              primary
              onPress={() =>
                run('tukar isPremium', () =>
                  setPremium(userData, !userData.isPremium)
                )
              }
            />
          </BtnRow>
          <View style={styles.dangerZone}>
            <Text style={styles.dangerZoneLabel}>Zon Berisiko</Text>
            <SmallBtn
              label="Buang Akses Admin Sendiri"
              danger
              full
              onPress={() =>
                Alert.alert(
                  'Buang akses admin?',
                  'Panel ini akan hilang sehingga seseorang jalankan `node scripts/admin.mjs grant-admin <uid>` semula dari terminal.',
                  [
                    { text: 'Batal', style: 'cancel' },
                    {
                      text: 'Buang',
                      style: 'destructive',
                      onPress: () =>
                        run('buang isAdmin', async () => {
                          await setOwnAdmin(userData, false);
                          await refreshUserData();
                          router.replace('/(tabs)/profile');
                        }),
                    },
                  ]
                )
              }
            />
          </View>
        </Section>

        {/* ============ REFRESH ============ */}
        <Section title="🔄 Muat Semula" subtitle="Tarik snapshot terkini dari Firestore">
          <BtnRow>
            <SmallBtn
              label="Refresh Data"
              primary
              full
              onPress={() => {
                run('refresh', () => fetchSnapshot(userData));
              }}
            />
          </BtnRow>
          <Text style={styles.footnote}>
            Tip: Refresh digunakan selepas tweak manual dari Firebase
            Console untuk pastikan UI sync dengan data sebenar.
          </Text>
        </Section>

        {/* Footer */}
        <View style={styles.footerBlock}>
          <Text style={styles.footerTitle}>Panel Pentadbir v1</Text>
          <Text style={styles.footerHint}>
            Perubahan terus tulis ke{' '}
            <Text style={styles.codeInline}>users/{userData.uid.slice(0, 12)}…</Text>.
            Semua tindakan direkodkan dalam koleksi transactions untuk
            audit.
          </Text>
        </View>
      </ScrollView>

      {/* Global loading veil during mutations */}
      {busy && (
        <View style={styles.busyOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={Colors.white} />
        </View>
      )}

      {/* Custom-input modal — shared between tokens, XP, level, lives */}
      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modal?.title ?? ''}</Text>
            <Text style={styles.modalLabel}>{modal?.label}</Text>
            <TextInput
              style={styles.modalInput}
              value={modalInput}
              onChangeText={setModalInput}
              keyboardType="numeric"
              placeholder={modal?.placeholder}
              placeholderTextColor={Colors.light.textSecondary}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={closeModal}
              >
                <Text style={styles.modalBtnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={() => {
                  if (!modal) return;
                  const parsed = Number(modalInput);
                  if (!Number.isFinite(parsed)) {
                    Alert.alert('Nombor tidak sah', 'Sila masukkan nombor.');
                    return;
                  }
                  void modal.onSubmit(parsed);
                  closeModal();
                }}
              >
                <Text style={styles.modalBtnSubmitText}>
                  {modal?.submitLabel ?? 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------- Local UI helpers ---------------------------------------------
// Kept inline because this is a single-screen feature and pulling them
// into shared components would be premature extraction.

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function BtnRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.btnRow}>{children}</View>;
}

function SmallBtn({
  label,
  onPress,
  primary,
  danger,
  full,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  full?: boolean;
}) {
  const style = [
    styles.smallBtn,
    primary && styles.smallBtnPrimary,
    danger && styles.smallBtnDanger,
    full && styles.smallBtnFull,
  ];
  const textStyle = [
    styles.smallBtnText,
    primary && styles.smallBtnTextPrimary,
    danger && styles.smallBtnTextDanger,
  ];
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.8}>
      <Text style={textStyle} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------- Theme --------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  backIcon: {
    fontSize: 28,
    color: Colors.primary,
    marginTop: -4,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  headerSpacer: {
    width: 36,
  },

  // Identity banner
  identityCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Colors.accent,
    marginBottom: 4,
  },
  identityName: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  identityUid: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  identityBadgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  identityBadgeAdmin: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  identityBadgeAdminText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.6,
  },

  // Section
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sectionBody: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.surfaceAlt,
  },
  valueLabel: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  valueBig: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
  },
  xpSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  xpSubLabel: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  xpSubValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  smallBtn: {
    backgroundColor: Colors.light.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  smallBtnDanger: {
    backgroundColor: Colors.error,
  },
  smallBtnFull: {
    flexGrow: 1,
    minWidth: '100%',
  },
  smallBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  smallBtnTextPrimary: {
    color: Colors.white,
  },
  smallBtnTextDanger: {
    color: Colors.white,
  },
  dangerZone: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.surfaceAlt,
  },
  dangerZoneLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.error,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  footnote: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // Footer
  footerBlock: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerHint: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: Spacing.md,
  },
  codeInline: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: FontSize.xs,
    backgroundColor: Colors.light.surfaceAlt,
    paddingHorizontal: 4,
    borderRadius: 3,
    color: Colors.primary,
  },

  // Gate / non-admin
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  gateIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  gateTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  gateBody: {
    fontSize: FontSize.md,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  gateBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
  },
  gateBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },

  // Busy overlay
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,37,64,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,37,64,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  modalLabel: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
  },
  modalInput: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.light.surfaceAlt,
  },
  modalBtnCancelText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalBtnSubmit: {
    backgroundColor: Colors.primary,
  },
  modalBtnSubmitText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
