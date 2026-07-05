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
import { Routes } from '@/constants/routes';

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
 * UI structure (top → bottom):
 *   1. Header with back button + title
 *   2. Identity banner (gradient + avatar circle + ADMIN badge)
 *   3. Quick-stats grid (2x2: Token, XP, Level, Nyawa) — at-a-glance
 *   4. Action sections (each with one primary CTA + chip-style secondary)
 *      - Token  — quick grant/set actions
 *      - XP     — quick grant + per-counter set
 *      - Level  — bump/decrement + custom
 *      - Nyawa  — refill + set + cooldown clear
 *      - Akaun  — premium toggle + danger zone (admin revoke)
 *      - Refresh — server sync
 *   5. Footer with attribution
 *
 * All callbacks stay identical to the previous version — only the
 * visual structure has been reorganised for clarity (bento-grid
 * layout, gradient identity card, primary vs chip button hierarchy).
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

  const initial = (userData.displayName?.trim()?.charAt(0) || userData.email?.charAt(0) || 'K').toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ============ HEADER ============ */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Panel Pentadbir</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ============ IDENTITY (gradient banner) ============ */}
        <View style={styles.identityCard}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityAvatarText}>{initial}</Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.identityLabel}>LOG MASUK SEBAGAI</Text>
            <Text style={styles.identityName} numberOfLines={1}>
              {userData.displayName || 'Saudara'}
            </Text>
            <Text style={styles.identityUid} numberOfLines={1}>
              {userData.email || userData.uid}
            </Text>
          </View>
          <View style={styles.identityBadgeAdmin}>
            <Text style={styles.identityBadgeAdminText}>ADMIN</Text>
            <Text style={styles.identityBadgeAdminCheck}>✓</Text>
          </View>
        </View>

        {/* ============ QUICK STATS (2x2 bento grid) ============ */}
        <View style={styles.statsGrid}>
          <StatTile
            icon="🪙"
            label="Token"
            value={userData.tokens ?? 0}
            accent={Colors.accent}
          />
          <StatTile
            icon="⭐"
            label="Total XP"
            value={userData.totalXP ?? 0}
            accent="#3B82F6"
          />
          <StatTile
            icon="🏆"
            label="Level"
            value={userData.currentLevel ?? 1}
            accent="#F59E0B"
          />
          <StatTile
            icon="❤️"
            label="Nyawa"
            value={`${userData.lives ?? LIVES_CONFIG.MAX} / ${LIVES_CONFIG.MAX}`}
            accent="#EF4444"
          />
        </View>

        {/* ============ TOKEN ============ */}
        <ActionSection
          icon="🪙"
          title="Token"
          subtitle="Urus baki token anda"
        >
          <View style={styles.chipRow}>
            <Chip label="+50" tone="success" onPress={() => run('+50 token', () => grantTokens(userData, 50))} />
            <Chip label="+100" tone="success" onPress={() => run('+100 token', () => grantTokens(userData, 100))} />
            <Chip label="+500" tone="success" onPress={() => run('+500 token', () => grantTokens(userData, 500))} />
            <Chip label="-50" tone="danger" onPress={() => run('-50 token', () => grantTokens(userData, -50))} />
          </View>
          <PrimaryButton
            label="Tambah / Set Custom"
            onPress={() =>
              Alert.alert(
                'Token Custom',
                'Pilih tindakan',
                [
                  {
                    text: 'Tambah (delta)',
                    onPress: () =>
                      showCustomModal({
                        title: 'Tambah Token (Delta)',
                        label: 'Jumlah (boleh negatif)',
                        placeholder: 'contoh: 250',
                        submitLabel: 'Tambah',
                        onSubmit: (n) => run('tambah token', () => grantTokens(userData, n)),
                      }),
                  },
                  {
                    text: 'Set (replace)',
                    onPress: () =>
                      showCustomModal({
                        title: 'Set Token (Replace)',
                        label: 'Nilai baru',
                        placeholder: 'contoh: 1000',
                        submitLabel: 'Set',
                        onSubmit: (n) => run('set token', () => setTokens(userData, n)),
                      }),
                  },
                  { text: 'Batal', style: 'cancel' },
                ]
              )
            }
          />
        </ActionSection>

        {/* ============ XP ============ */}
        <ActionSection
          icon="⭐"
          title="XP"
          subtitle="Tambah atau set XP untuk semua counter"
        >
          <View style={styles.subStats}>
            <SubStat label="Mingguan" value={userData.weeklyXP ?? 0} />
            <SubStat label="Bulanan" value={userData.monthlyXP ?? 0} />
          </View>
          <View style={styles.chipRow}>
            <Chip label="+500" tone="success" onPress={() => run('+500 XP', () => grantXp(userData, 500))} />
            <Chip label="+2000" tone="success" onPress={() => run('+2000 XP', () => grantXp(userData, 2000))} />
            <Chip label="+10K" tone="success" onPress={() => run('+10K XP', () => grantXp(userData, 10000))} />
            <Chip label="-1000" tone="danger" onPress={() => run('-1000 XP', () => grantXp(userData, -1000))} />
          </View>
          <PrimaryButton
            label="Set XP Custom"
            onPress={() =>
              Alert.alert(
                'XP Custom',
                'Pilih counter untuk set',
                [
                  {
                    text: 'Total',
                    onPress: () =>
                      showCustomModal({
                        title: 'Set Total XP',
                        label: 'Nilai baru',
                        placeholder: 'contoh: 5000',
                        submitLabel: 'Set',
                        onSubmit: (n) =>
                          run('set totalXP', () =>
                            setXp(userData, n, userData.weeklyXP ?? 0, userData.monthlyXP ?? 0)
                          ),
                      }),
                  },
                  {
                    text: 'Mingguan',
                    onPress: () =>
                      showCustomModal({
                        title: 'Set Weekly XP',
                        label: 'Nilai baru',
                        placeholder: 'contoh: 500',
                        submitLabel: 'Set',
                        onSubmit: (n) =>
                          run('set weeklyXP', () =>
                            setXp(userData, userData.totalXP ?? 0, n, userData.monthlyXP ?? 0)
                          ),
                      }),
                  },
                  {
                    text: 'Bulanan',
                    onPress: () =>
                      showCustomModal({
                        title: 'Set Monthly XP',
                        label: 'Nilai baru',
                        placeholder: 'contoh: 1200',
                        submitLabel: 'Set',
                        onSubmit: (n) =>
                          run('set monthlyXP', () =>
                            setXp(userData, userData.totalXP ?? 0, userData.weeklyXP ?? 0, n)
                          ),
                      }),
                  },
                  { text: 'Batal', style: 'cancel' },
                ]
              )
            }
          />
        </ActionSection>

        {/* ============ LEVEL ============ */}
        <ActionSection
          icon="🏆"
          title="Level"
          subtitle="Tetapkan level akses"
        >
          <View style={styles.chipRow}>
            <Chip label="+1" tone="success" onPress={() => run('+1 level', () => setCurrentLevel(userData, (userData.currentLevel ?? 1) + 1))} />
            <Chip label="+5" tone="success" onPress={() => run('+5 level', () => setCurrentLevel(userData, (userData.currentLevel ?? 1) + 5))} />
            <Chip label="-5" tone="danger" onPress={() => run('-5 level', () => setCurrentLevel(userData, Math.max(1, (userData.currentLevel ?? 1) - 5)))} />
            <Chip label="Reset 1" tone="danger" onPress={() => run('reset level', () => setCurrentLevel(userData, 1))} />
          </View>
          <PrimaryButton
            label="Set Level Custom"
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
        </ActionSection>

        {/* ============ LIVES ============ */}
        <ActionSection
          icon="❤️"
          title="Nyawa"
          subtitle="Isi semula atau ubah nilai nyawa"
        >
          {/* Heart row — visualizes current lives as 5 filled /
              empty hearts. At-a-glance state without needing to
              read the number. */}
          <LivesHearts count={userData.lives ?? LIVES_CONFIG.MAX} max={LIVES_CONFIG.MAX} />

          {/* Status pills — show live system state with colored
              dots (green = aktif, grey = tidak). Replaces the
              previous plain text "—" / "aktif" labels. */}
          <View style={styles.subStats}>
            <StatusPill
              icon="⏱"
              label="Anchor"
              active={!!userData.livesLastLostAt}
            />
            <StatusPill
              icon="📺"
              label="Ad Cooldown"
              active={!!userData.lastAdRefillAt}
            />
          </View>

          <View style={styles.twoCol}>
            <PrimaryButton
              label="Isi Penuh"
              tone="success"
              onPress={() => run('isi semula nyawa', () => refillLives(userData))}
            />
            <PrimaryButton
              label="Set Custom"
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
          </View>
          <SecondaryButton
            label="Buang Cooldown"
            onPress={() => run('buang cooldown nyawa', () => clearLivesCooldowns(userData))}
          />
        </ActionSection>

        {/* ============ ACCOUNT ============ */}
        <ActionSection
          icon="👑"
          title="Akaun"
          subtitle="Tukar status akaun & akses admin"
        >
          {/* PRO status badge — large celebratory card when the
              user is premium, neutral card when basic. Gives the
              toggle screen a clear "this is what you have"
              anchor before the action button below. */}
          <View
            style={[
              styles.proCard,
              userData.isPremium ? styles.proCardActive : styles.proCardBasic,
            ]}
          >
            <View style={styles.proCardIconWrap}>
              <Text style={styles.proCardIcon}>👑</Text>
            </View>
            <View style={styles.proCardText}>
              <Text
                style={[
                  styles.proCardLabel,
                  userData.isPremium ? styles.proCardLabelActive : styles.proCardLabelBasic,
                ]}
              >
                {userData.isPremium ? 'PRO MEMBER' : 'AKAUN BIASA'}
              </Text>
              <Text
                style={[
                  styles.proCardDesc,
                  userData.isPremium ? styles.proCardDescActive : styles.proCardDescBasic,
                ]}
              >
                {userData.isPremium
                  ? 'Akses penuh ke topik & ciri premium'
                  : 'Naik taraf untuk unlock ciri premium'}
              </Text>
            </View>
          </View>
          <PrimaryButton
            label={userData.isPremium ? 'Turun ke Biasa' : 'Naik Taraf ke PRO'}
            tone={userData.isPremium ? 'neutral' : 'success'}
            onPress={() => run('tukar isPremium', () => setPremium(userData, !userData.isPremium))}
          />

          {/* Danger zone — visually isolated from the rest of the
              account actions with its own bordered card and red label.
              Single destructive action: revoke own admin access. */}
          <View style={styles.dangerZone}>
            <Text style={styles.dangerZoneLabel}>⚠ ZON BERISIKO</Text>
            <DangerButton
              label="Buang Akses Admin Sendiri"
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
                          router.replace(Routes.PROFILE);
                        }),
                    },
                  ]
                )
              }
            />
          </View>
        </ActionSection>

        {/* ============ REFRESH ============ */}
        <ActionSection
          icon="🔄"
          title="Muat Semula"
          subtitle="Tarik snapshot terkini dari Firestore"
        >
          <PrimaryButton
            label="Refresh Data"
            onPress={() => run('refresh', () => fetchSnapshot(userData))}
          />
          <Text style={styles.footnote}>
            Tip: Refresh digunakan selepas tweak manual dari Firebase
            Console untuk pastikan UI sync dengan data sebenar.
          </Text>
        </ActionSection>

        {/* ============ FOOTER ============ */}
        <View style={styles.footerBlock}>
          <Text style={styles.footerTitle}>PANEL PENTADBIR v1</Text>
          <Text style={styles.footerHint}>
            Perubahan terus tulis ke <Text style={styles.codeInline}>users/{userData.uid.slice(0, 12)}…</Text>.
            Semua tindakan direkodkan dalam koleksi transactions untuk audit.
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

/** Stat tile for the 2x2 quick-stats bento grid. */
function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statTileIconWrap, { backgroundColor: accent + '22' }]}>
        <Text style={styles.statTileIcon}>{icon}</Text>
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={[styles.statTileValue, { color: accent }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Sub-stat row inside an ActionSection (e.g. Weekly XP / Monthly XP). */
function SubStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.subStat}>
      <Text style={styles.subStatLabel}>{label}</Text>
      <Text style={styles.subStatValue}>{value}</Text>
    </View>
  );
}

/**
 * Heart row — visualizes current lives as filled / empty heart
 * icons. Gives the admin panel an at-a-glance read of the lives
 * state without needing to parse a number. Used in the Lives
 * section.
 */
function LivesHearts({ count, max }: { count: number; max: number }) {
  const hearts = Array.from({ length: max }, (_, i) => i < count);
  return (
    <View style={styles.livesHeartsRow}>
      {hearts.map((filled, i) => (
        <Text
          key={i}
          style={[styles.livesHeart, filled ? styles.livesHeartFilled : styles.livesHeartEmpty]}
        >
          {filled ? '❤️' : '🤍'}
        </Text>
      ))}
      <View style={styles.livesCount}>
        <Text style={styles.livesCountText}>
          {count} / {max}
        </Text>
      </View>
    </View>
  );
}

/**
 * Status pill with icon and active/inactive indicator. Used for
 * the boolean-style system states in the Lives section (anchor,
 * ad cooldown). Green dot + "Aktif" when true, grey dot + "Tiada"
 * when false.
 */
function StatusPill({
  icon,
  label,
  active,
}: {
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <View style={[styles.statusPillWrap, active ? styles.statusPillActive : styles.statusPillInactive]}>
      <View style={styles.statusPillIconWrap}>
        <Text style={styles.statusPillIcon}>{icon}</Text>
      </View>
      <View style={styles.statusPillContent}>
        <Text style={styles.statusPillLabel}>{label}</Text>
        <View style={styles.statusPillRow}>
          <View style={[styles.statusDot, active ? styles.statusDotActive : styles.statusDotInactive]} />
          <Text style={[styles.statusPillValue, active ? styles.statusPillValueActive : styles.statusPillValueInactive]}>
            {active ? 'Aktif' : 'Tiada'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Action section card — wraps a category of admin actions with an
 * icon header and a clean body area. Replaces the old `Section`
 * component with a more visually distinct header.
 */
function ActionSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.actionSection}>
      <View style={styles.actionSectionHeader}>
        <View style={styles.actionSectionIconWrap}>
          <Text style={styles.actionSectionIcon}>{icon}</Text>
        </View>
        <View style={styles.actionSectionHeaderText}>
          <Text style={styles.actionSectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.actionSectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.actionSectionBody}>{children}</View>
    </View>
  );
}

/** Small chip-style button. Tones: success (green), danger (red), neutral. */
function Chip({
  label,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  tone?: 'success' | 'danger' | 'neutral';
}) {
  const style = [
    styles.chip,
    tone === 'success' && styles.chipSuccess,
    tone === 'danger' && styles.chipDanger,
  ];
  const textStyle = [
    styles.chipText,
    tone === 'success' && styles.chipTextSuccess,
    tone === 'danger' && styles.chipTextDanger,
  ];
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.7}>
      <Text style={textStyle} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Primary CTA button — full-width, prominent. */
function PrimaryButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'success' | 'neutral';
}) {
  const style = [
    styles.primaryBtn,
    tone === 'success' && styles.primaryBtnSuccess,
    tone === 'neutral' && styles.primaryBtnNeutral,
  ];
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Secondary button — ghost style for less-important actions. */
function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Danger zone action — red bordered button. */
function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.dangerBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.dangerBtnText}>{label}</Text>
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

  // Identity banner — gradient background, avatar circle, ADMIN badge
  identityCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  identityAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  identityAvatarText: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  identityInfo: {
    flex: 1,
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Colors.accent,
    marginBottom: 2,
  },
  identityName: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.white,
  },
  identityUid: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  identityBadgeAdmin: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: Spacing.xs,
  },
  identityBadgeAdminText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  identityBadgeAdminCheck: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primary,
  },

  // 2x2 quick-stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statTileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs + 2,
  },
  statTileIcon: {
    fontSize: 18,
  },
  statTileLabel: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statTileValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginTop: 2,
  },

  // Action section
  actionSection: {
    marginBottom: Spacing.md,
  },
  actionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs + 2,
    paddingHorizontal: 2,
  },
  actionSectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs + 2,
  },
  actionSectionIcon: {
    fontSize: 14,
  },
  actionSectionHeaderText: {
    flex: 1,
  },
  actionSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    lineHeight: 20,
  },
  actionSectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  actionSectionBody: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  // Sub-stats row (XP weekly/monthly, Lives anchor/cooldown)
  subStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  subStat: {
    flex: 1,
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  subStatLabel: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  subStatValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },

  // Chip row — small inline action chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 8,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.light.surfaceAlt,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSuccess: {
    backgroundColor: '#10B98122',
    borderColor: '#10B98155',
  },
  chipDanger: {
    backgroundColor: '#EF444422',
    borderColor: '#EF444455',
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  chipTextSuccess: {
    color: '#059669',
  },
  chipTextDanger: {
    color: '#DC2626',
  },

  // Primary CTA
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtnSuccess: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  primaryBtnNeutral: {
    backgroundColor: Colors.light.surfaceAlt,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Two-column button row
  twoCol: {
    flexDirection: 'row',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.sm,
  },

  // Secondary button (ghost)
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textDecorationLine: 'underline',
  },

  // Status row + pill (Account section — replaced by proCard)
  // Keeping the empty block here just so the old `statusRow`/
  // `statusLabel` references in styles are cleaned up — the
  // Account section now uses `proCard` for the PRO/Akaun visual.
  statusRow: undefined as unknown as object,
  statusLabel: undefined as unknown as object,
  statusPill: undefined as unknown as object,
  statusPillPro: undefined as unknown as object,
  statusPillBasic: undefined as unknown as object,
  statusPillText: undefined as unknown as object,
  statusPillTextPro: undefined as unknown as object,
  statusPillTextBasic: undefined as unknown as object,

  // PRO status card — celebratory card when user is premium,
  // neutral card when basic. Bigger visual anchor than a small
  // pill so the admin user immediately sees what state they're
  // editing before tapping the toggle below.
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm + 2,
  },
  proCardActive: {
    backgroundColor: '#D4AF3711',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  proCardBasic: {
    backgroundColor: Colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  proCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proCardIcon: {
    fontSize: 24,
  },
  proCardText: {
    flex: 1,
  },
  proCardLabel: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  proCardLabelActive: {
    color: '#8B6914', // deeper gold for contrast on light gold bg
  },
  proCardLabelBasic: {
    color: Colors.light.textSecondary,
  },
  proCardDesc: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  proCardDescActive: {
    color: '#8B6914',
  },
  proCardDescBasic: {
    color: Colors.light.textSecondary,
  },

  // Lives heart row — at-a-glance visualization of current lives.
  livesHeartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#FEE2E211',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  livesHeart: {
    fontSize: 22,
  },
  livesHeartFilled: {
    opacity: 1,
  },
  livesHeartEmpty: {
    opacity: 0.3,
  },
  livesCount: {
    marginLeft: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: '#EF444433',
  },
  livesCountText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: '#DC2626',
  },

  // Status pill — boolean-style state (anchor, ad cooldown).
  // Replaces the previous plain text "—" / "aktif" labels.
  statusPillWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs + 2,
  },
  statusPillActive: {
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B98144',
  },
  statusPillInactive: {
    backgroundColor: Colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusPillIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillIcon: {
    fontSize: 14,
  },
  statusPillContent: {
    flex: 1,
  },
  statusPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotInactive: {
    backgroundColor: '#94A3B8',
  },
  statusPillValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statusPillValueActive: {
    color: '#059669',
  },
  statusPillValueInactive: {
    color: Colors.light.textSecondary,
  },

  // Danger zone
  dangerZone: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#EF444433',
  },
  dangerZoneLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs + 2,
  },
  dangerBtn: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    backgroundColor: '#EF444411',
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#DC2626',
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Footnote inside Refresh section
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
    fontSize: 10,
    fontWeight: '800',
    color: Colors.light.textSecondary,
    letterSpacing: 1.4,
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
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
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