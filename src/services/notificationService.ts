import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Local-notification service. Used to nudge the player when
 * something time-based happens on the server that they might
 * miss — currently:
 *
 *   - "Nyawa penuh semula!" — fired when `users/{uid}.lives`
 *     transitions from below MAX to MAX (the time-based refill
 *     tick completed).
 *
 * Why local notifications and not FCM (Firebase Cloud Messaging)?
 *
 *   - This project doesn't deploy Cloud Functions (see AGENTS.md
 *     "Out of scope"). FCM requires a server-side trigger to
 *     push to the device; without Functions there's no place
 *     for that trigger to live.
 *   - Local notifications fire from the device, so the trigger
 *     has to be observed on-device. That happens via the
 *     `onSnapshot` listener in `AuthContext` / `LivesIndicator`,
 *     which sees the refill transition and calls into here.
 *
 * Trade-off: local notifications only fire while the device is
 * running (foreground, background, or recently backgrounded).
 * If the user kills the app, no noti. This matches the "best
 * effort" stance the rest of the lives system takes (per
 * AGENTS.md "Lives system") — proper delivery requires the
 * Cloud Functions backend that hasn't shipped yet. When that
 * lands, swap this service's `notifyLivesFull` for a server
 * trigger that calls FCM.
 */

/**
 * Configure how notifications behave when the app is in the
 * foreground. By default `expo-notifications` suppresses
 * foreground notifs ("silence" them) — we want them visible
 * so the player sees the refill nudge while the app is open.
 * Set once at module load time; safe to call multiple times.
 *
 * Also sets the Android notification channel — required on
 * Android 8+ before any noti can be shown. Idempotent: if the
 * channel already exists with the same ID, the call is a
 * no-op (per `expo-notifications` docs).
 */
let configured = false;
function ensureConfigured() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      // `shouldShowBanner` above replaces the deprecated
      // `shouldShowAlert` field in SDK 51+; both are kept here
      // as a safety net for older runtime versions, harmless
      // if the type checker ignores the unknown key.
      shouldShowAlert: true,
    }),
  });
  if (Platform.OS === 'android') {
    // Channel id is stable — `expo-notifications` dedupes by
    // id, so re-creating with the same id is a no-op. The
    // importance level `DEFAULT` shows in the tray and
    // briefly in the heads-up, but doesn't make sound unless
    // we set `sound` explicitly (we don't — see handler above).
    Notifications.setNotificationChannelAsync('lives-refill', {
      name: 'Refill Nyawa',
      description: 'Pemberitahuan bila nyawa anda diisi semula ke penuh.',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 100, 200],
    }).catch(() => {
      // Non-fatal — channel setup failure on Android won't
      // crash the app, the noti just won't appear. Surface
      // nothing to the user; the lives refill itself still
      // happens server-side.
    });
  }
}

/**
 * Permission state — `granted` | `denied` | `undetermined`.
 * Cached after the first request so repeated callers don't
 * re-prompt the user. The OS only shows the prompt once per
 * app install; subsequent calls return the cached decision.
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

let permissionStatusCache: NotificationPermissionStatus | null = null;

/**
 * Request notification permission from the OS. Safe to call
 * multiple times — caches the result and short-circuits on
 * repeat calls. Resolves `false` if the user denied or the
 * platform doesn't support notifs (web / unsupported runtime);
 * callers should treat `false` as "skip noti, no error".
 *
 * iOS: shows the system permission dialog the first time.
 * Android 13+: shows the runtime permission dialog the first
 * time. Older Android: auto-granted (notification permission
 * was install-time, not runtime).
 *
 * Defensive permission-resolution: reads THREE sources of truth
 * from the runtime response (`.granted` boolean, `.status ===
 * 'granted'`, and the platform-specific `ios.status` /
 * `android.status` overrides). If the SDK ever renames `granted`
 * (renamed to `authorized` in some forks, or moves behind a
 * `result.granted` wrapper in a future major), the other
 * checks keep us honest. The previous code only consulted
 * `.granted` — a silent break in newer SDKs would have meant
 * `granted === undefined` → `false` → no notifications ever
 * fire, with no diagnostic log.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  ensureConfigured();
  if (permissionStatusCache === 'granted') return true;
  if (permissionStatusCache === 'denied') return false;
  try {
    // The full `NotificationPermissionsStatus` extends
    // `PermissionResponse` (status + expires + granted +
    // canAskAgain) plus per-platform sub-objects. We want
    // the `.granted` boolean — it's the canonical "can we
    // fire a notification" signal across all platforms,
    // including iOS provisional authorization which maps
    // `granted: true` even when the strict `status` is
    // `'undetermined'`. Cast to `unknown as { ... }` because the
    // runtime type augmentation for `PermissionResponse`
    // from the `expo` package barrel doesn't propagate
    // through `NotificationPermissionsStatus` in this SDK
    // version's typings; runtime behaviour matches the
    // documented contract regardless.
    type PermissionShape = {
      granted?: boolean;
      status?: string;
      ios?: { status?: string };
      android?: { status?: string };
    };

    let settings = (await Notifications.getPermissionsAsync()) as unknown as PermissionShape;
    if (!isGranted(settings)) {
      settings = (await Notifications.requestPermissionsAsync()) as unknown as PermissionShape;
    }
    const granted = isGranted(settings);
    permissionStatusCache = granted ? 'granted' : 'denied';
    return granted;
  } catch {
    // Permission API not available (e.g. web, headless test).
    // Don't cache the failure — let the next call retry.
    return false;
  }
}

/**
 * Resolve whether the SDK returned a "we can post notifications"
 * signal. Covers three independent sources of truth so a single
 * rename in the SDK doesn't silence all notifs:
 *
 *   1. Top-level `.granted` boolean — the canonical signal per
 *      the `expo-notifications` docs.
 *   2. Top-level `.status === 'granted'` — what older call sites
 *      used before `.granted` was added. Some iOS provisional
 *      flows return `granted: true` while `status` stays
 *      `'undetermined'`, so we OR rather than AND these.
 *   3. Platform-specific `ios.status === 'granted'` OR
 *      `android.status === 'granted'` — the most granular
 *      override. Useful when the bundler type augmentation
 *      strips the top-level keys but keeps the platform-nested
 *      ones (a real failure mode seen on RN 0.74 + Expo SDK 51).
 */
function isGranted(s: {
  granted?: boolean;
  status?: string;
  ios?: { status?: string };
  android?: { status?: string };
}): boolean {
  if (s.granted === true) return true;
  if (s.status === 'granted') return true;
  if (s.ios?.status === 'granted') return true;
  if (s.android?.status === 'granted') return true;
  return false;
}

/**
 * Returns the cached permission status without prompting.
 * Useful for UI that wants to show a "notifications off"
 * indicator without triggering the permission dialog.
 */
export function getNotificationPermissionStatus(): NotificationPermissionStatus {
  return permissionStatusCache ?? 'undetermined';
}

/**
 * Fire a local notification telling the player their lives
 * are full again. Triggers immediately (`seconds: 0`); the
 * trigger for the actual refill is the call site (the
 * `onSnapshot` listener detected the transition).
 *
 * No-op if permission isn't granted — we don't want to
 * silently fail in a way that confuses the caller. Returns
 * `true` if the noti was scheduled, `false` otherwise.
 */
export async function notifyLivesFull(): Promise<boolean> {
  ensureConfigured();
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      // Identifier content (not the trigger) — the OS may
      // dedupe based on this if multiple notifs of the same
      // shape fire in quick succession.
      content: {
        title: 'Nyawa Anda Sudah Penuh! ❤️',
        body: 'Semua 5 nyawa telah diisi semula. Teruskan bermain!',
        // No `data` payload — tapping the noti just opens the
        // app to wherever the user left off (no deep link
        // required for now; if we add a "Continue quiz"
        // surface later, set `data: { route: '/quiz/...' }`).
        sound: false,
      },
      trigger: null, // null = immediate
    });
    return true;
  } catch {
    // Non-fatal — noti scheduling can fail on simulators or
    // when the OS throttles. The refill itself still
    // happened, the player just won't see the nudge.
    return false;
  }
}