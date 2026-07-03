/**
 * Shared Firebase Admin SDK initializer for one-off admin scripts under
 * `scripts/`. Loads the project ID from `app.json` extra config.
 *
 * Authentication priority (auto-detected, no manual switch needed):
 *
 *   1. process.env.FIREBASE_ADMIN_KEY_PATH  → service account JSON path
 *   2. ./serviceAccountKey.json            → service account JSON at project root
 *   3. process.env.GOOGLE_APPLICATION_CREDENTIALS → any credential JSON path
 *   4. gcloud-generated ADC (after `gcloud auth application-default login`)
 *      at $APPDATA\gcloud\application_default_credentials.json
 *
 * Service-account key creation is **often blocked by Org Policy** on managed
 * Google accounts ("Key creation is not allowed on this service account").
 * Path 4 (ADC via gcloud) bypasses that — uses the logged-in user's OAuth
 * identity instead of a downloaded service-account key.
 *
 * Lazy init: the Firebase Admin app is only initialised when you call
 * `getDb()` or `getAuth()` for the first time. This means scripts can
 * `import` this module without any credential on disk (e.g. `--help`).
 *
 * Setup (one-time) — pick the path that matches your org policy:
 *
 *   PATH A: service account JSON (if Org Policy allows it)
 *     1. Firebase Console → Project Settings → Service Accounts
 *        → "Generate new private key" → save as `serviceAccountKey.json`
 *        at project root (already in `.gitignore`).
 *     2. Run any subcommand — auto-detected.
 *
 *   PATH B: gcloud ADC (works under any Org Policy)
 *     1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install-windows
 *     2. gcloud init                                (login + pilih project)
 *     3. gcloud auth application-default login     (login sekali lagi untuk ADC)
 *     4. Run any subcommand — ADC auto-detected.
 *
 *   PATH C: env var (any credential JSON, e.g. CI ephemeral token)
 *     1. Set $env:GOOGLE_APPLICATION_CREDENTIALS = "<path-to-json>" in PowerShell
 *     2. Run any subcommand.
 *
 * Usage from another script:
 *
 *   import { getDb, getAuth, getProjectId } from './lib/admin-firebase.mjs';
 *   const snap = await getDb().collection('users').limit(5).get();
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  // Matches `app.json` -> `expo.extra.firebase.projectId`. Update this
  // string if the project ID ever changes.
  'katolikgo-mobile';

let _initialized = false;
let _db = null;
let _auth = null;
let _credentialSource = null;

// Well-known gcloud ADC location on Windows:
//   %APPDATA%\gcloud\application_default_credentials.json
function defaultGcloudAdcPath() {
  const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
  return join(appdata, 'gcloud', 'application_default_credentials.json');
}

function tryServiceAccount(path, label) {
  if (!existsSync(path)) return null;
  const json = JSON.parse(readFileSync(path, 'utf8'));
  if (json.type !== 'service_account') return null; // ADC file with authorized_user type
  return {
    credential: cert(json),
    source: `${label} (service_account)`,
  };
}

function tryAdcFile(path, label) {
  if (!path) return null;
  if (!existsSync(path)) return null;
  const json = JSON.parse(readFileSync(path, 'utf8'));
  if (json.type !== 'authorized_user') return null; // service_account handled above
  // google-auth-library's applicationDefault() handles this JSON format
  // when GOOGLE_APPLICATION_CREDENTIALS points at it.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  return {
    credential: applicationDefault(),
    source: `${label} (authorized_user / gcloud ADC)`,
  };
}

function loadCredential() {
  // 1. Explicit FIREBASE_ADMIN_KEY_PATH
  if (process.env.FIREBASE_ADMIN_KEY_PATH) {
    const p = resolve(process.env.FIREBASE_ADMIN_KEY_PATH);
    const sa = tryServiceAccount(p, `FIREBASE_ADMIN_KEY_PATH=${p}`);
    if (!sa) {
      throw new Error(`FIREBASE_ADMIN_KEY_PATH points at ${p} — file missing or not a service_account JSON.`);
    }
    return sa;
  }

  // 2. ./serviceAccountKey.json (project root)
  const rootDefault = resolve(projectRoot, 'serviceAccountKey.json');
  const rootSa = tryServiceAccount(rootDefault, `serviceAccountKey.json`);
  if (rootSa) return rootSa;

  // 3. GOOGLE_APPLICATION_CREDENTIALS (any credential JSON)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const p = resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (!existsSync(p)) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS points at ${p} — file missing.`);
    }
    const adc = tryAdcFile(p, `GOOGLE_APPLICATION_CREDENTIALS=${p}`);
    if (adc) return adc;
    // Also handle service_account JSON via env var
    const sa = tryServiceAccount(p, `GOOGLE_APPLICATION_CREDENTIALS=${p}`);
    if (sa) return sa;
    throw new Error(`GOOGLE_APPLICATION_CREDENTIALS=${p} — JSON tidak dikenali (type field unknown).`);
  }

  // 4. gcloud ADC at well-known Windows location
  const gcloudAdc = defaultGcloudAdcPath();
  if (existsSync(gcloudAdc)) {
    const adc = tryAdcFile(gcloudAdc, `gcloud ADC at ${gcloudAdc}`);
    if (adc) return adc;
  }

  // 5. Nothing on disk — throw a friendly error instead of letting
  //    applicationDefault() silently return a credential that later
  //    explodes asynchronously on the first Firestore call.
  //    (Cloud runtimes with metadata-server creds are out of scope for
  //    local admin scripts.)
  throw new Error(
    'TIADA credentials dijumpai. Pilih satu path:\n' +
      '\n' +
      '  PATH A — service account JSON (jika Org Policy izinkan):\n' +
      '    Firebase Console → Project Settings → Service Accounts\n' +
      '      → "Generate new private key" → save as serviceAccountKey.json\n' +
      '      at project root.\n' +
      '\n' +
      '  PATH B — gcloud ADC (works under Org Policy that blocks key gen):\n' +
      '    1. Install: https://cloud.google.com/sdk/docs/install-windows\n' +
      '    2. gcloud init                                   (login, pilih project)\n' +
      '    3. gcloud auth application-default login        (OAuth browser login)\n' +
      '    4. Run script semula — auto-detected.\n' +
      '\n' +
      '  PATH C — env var pointing at any credential JSON:\n' +
      "    $env:GOOGLE_APPLICATION_CREDENTIALS = '<path>'\n" +
      '    node scripts/admin.mjs ...\n' +
      '\n' +
      `Checked paths:\n` +
      `  FIREBASE_ADMIN_KEY_PATH             = ${process.env.FIREBASE_ADMIN_KEY_PATH || '(unset)'}\n` +
      `  GOOGLE_APPLICATION_CREDENTIALS      = ${process.env.GOOGLE_APPLICATION_CREDENTIALS || '(unset)'}\n` +
      `  ${rootDefault}\n` +
      `  ${gcloudAdc}\n`
  );
}

function init() {
  if (_initialized) return;
  const { credential, source } = loadCredential();
  initializeApp({
    credential,
    projectId: PROJECT_ID,
  });
  _db = getFirestore();
  _auth = adminGetAuth();
  _credentialSource = source;
  _initialized = true;
}

export function getDb() {
  init();
  return _db;
}

export function getAuth() {
  init();
  return _auth;
}

export function getProjectId() {
  return PROJECT_ID;
}

export function getCredentialSource() {
  init();
  return _credentialSource;
}

export { FieldValue, FieldPath } from 'firebase-admin/firestore';
