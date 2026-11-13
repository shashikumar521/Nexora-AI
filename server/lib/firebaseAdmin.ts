import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  cert,
  type App as AdminApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';

interface AppletConfigShape {
  projectId?: string;
  firestoreDatabaseId?: string;
}

interface ParsedServiceAccount extends ServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

declare global {
  var _nexoraAdminApp: AdminApp | undefined;
  var _nexoraAdminFirestore: AdminFirestore | undefined;
  var _nexoraAdminFirestoreDbId: string | undefined;
  var _nexoraAdminInitError: string | undefined;
}

let cachedAppletConfig: AppletConfigShape | null = null;

function loadFirebaseAppletConfig(): AppletConfigShape {
  if (cachedAppletConfig) {
    return cachedAppletConfig;
  }

  const candidatePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];

  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(path.resolve(here, '../../firebase-applet-config.json'));
  } catch {
    // Ignore if import.meta.url is unavailable in bundled CJS
  }

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        cachedAppletConfig = JSON.parse(raw) as AppletConfigShape;
        return cachedAppletConfig;
      }
    } catch {
      // Try next candidate path
    }
  }

  cachedAppletConfig = {};
  return cachedAppletConfig;
}

function unwrapSurroundingQuotes(input: string): string {
  let s = input.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Safely parse FIREBASE_SERVICE_ACCOUNT_JSON across normal JSON, escaped JSON,
 * base64-encoded JSON, or escaped \\n private_key formats without ever logging secrets.
 */
export function parseServiceAccountCredentials(): ParsedServiceAccount | null {
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawEnv || !rawEnv.trim()) {
    return null;
  }

  let candidate = unwrapSurroundingQuotes(rawEnv);

  const parseAttempt = (text: string): ParsedServiceAccount | null => {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') {
      // Handle double-JSON-encoded string
      return JSON.parse(parsed) as ParsedServiceAccount;
    }
    if (parsed && typeof parsed === 'object') {
      return parsed as ParsedServiceAccount;
    }
    return null;
  };

  let parsed: ParsedServiceAccount | null = null;
  let lastError: unknown = null;

  const attempts: string[] = [candidate];

  // Attempt unescaping if string contains escaped quotes (e.g. {\"type\":\"service_account\"...})
  if (candidate.includes('\\"')) {
    attempts.push(candidate.replace(/\\"/g, '"'));
  }

  // Attempt base64 decoding if not starting with '{'
  if (!candidate.startsWith('{')) {
    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        attempts.push(decoded);
      }
    } catch {
      // Ignore base64 fallback failure
    }
  }

  for (const text of attempts) {
    try {
      parsed = parseAttempt(text);
      if (parsed) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!parsed) {
    const reason = lastError instanceof Error ? lastError.message : 'Invalid JSON structure';
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON (${reason}).`);
  }

  const rawPrivateKey = (parsed.private_key || parsed.privateKey || '').trim();
  const clientEmail = (parsed.client_email || parsed.clientEmail || '').trim();
  const projectId = (parsed.project_id || parsed.projectId || '').trim();

  if (!clientEmail || !rawPrivateKey) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields (client_email or private_key).'
    );
  }

  // Normalize literal "\\n" sequences into real PEM newlines
  const normalizedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');

  return {
    ...parsed,
    project_id: projectId,
    projectId: projectId,
    client_email: clientEmail,
    clientEmail: clientEmail,
    private_key: normalizedPrivateKey,
    privateKey: normalizedPrivateKey,
  };
}

export function isFirebaseServiceAccountConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}

export function getFirebaseProjectId(): string {
  const fromEnv = unwrapSurroundingQuotes(process.env.FIREBASE_PROJECT_ID || '');
  if (fromEnv) return fromEnv;

  try {
    const creds = parseServiceAccountCredentials();
    if (creds?.project_id) return creds.project_id;
  } catch {
    // Ignore parse error here; surfaced during Admin initialization
  }

  const appletCfg = loadFirebaseAppletConfig();
  return (appletCfg.projectId || '').trim();
}

export function getFirebaseDatabaseId(): string {
  const fromEnv = unwrapSurroundingQuotes(process.env.FIREBASE_DATABASE_ID || '');
  if (fromEnv) {
    if (fromEnv.toLowerCase() === 'default') {
      return '(default)';
    }
    return fromEnv;
  }

  const appletCfg = loadFirebaseAppletConfig();
  const fromCfg = (appletCfg.firestoreDatabaseId || '').trim();
  if (fromCfg.toLowerCase() === 'default') {
    return '(default)';
  }
  return fromCfg || '(default)';
}

export function getFirebaseAdminApp(): AdminApp | null {
  if (globalThis._nexoraAdminApp) {
    return globalThis._nexoraAdminApp;
  }

  if (!isFirebaseServiceAccountConfigured()) {
    return null;
  }

  try {
    const existing = getAdminApps().find((a) => a.name === 'nexora-admin');
    if (existing) {
      globalThis._nexoraAdminApp = existing;
      globalThis._nexoraAdminInitError = undefined;
      return existing;
    }

    const credentials = parseServiceAccountCredentials();
    if (!credentials) {
      return null;
    }

    const projectId = credentials.project_id || getFirebaseProjectId();
    const app = initializeAdminApp(
      {
        credential: cert(credentials),
        projectId,
      },
      'nexora-admin'
    );

    globalThis._nexoraAdminApp = app;
    globalThis._nexoraAdminInitError = undefined;
    console.log(`[FirebaseAdmin] Initialized successfully (project: ${projectId || 'unknown'}).`);
    return app;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    globalThis._nexoraAdminInitError = msg;
    console.error('[FirebaseAdmin] Initialization failed:', msg);
    return null;
  }
}

export function getFirebaseAdminAuth(): AdminAuth | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getAdminAuth(app);
}

export function getFirebaseAdminFirestore(): AdminFirestore | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;

  const databaseId = getFirebaseDatabaseId();
  if (
    globalThis._nexoraAdminFirestore &&
    globalThis._nexoraAdminFirestoreDbId === databaseId
  ) {
    return globalThis._nexoraAdminFirestore;
  }

  const db =
    !databaseId || databaseId === '(default)'
      ? getAdminFirestore(app)
      : getAdminFirestore(app, databaseId);

  globalThis._nexoraAdminFirestore = db;
  globalThis._nexoraAdminFirestoreDbId = databaseId;
  console.log(`[FirebaseAdmin] Firestore ready (database: ${databaseId}).`);
  return db;
}

export function getFirebaseAdminStatus(): {
  configured: boolean;
  initialized: boolean;
  projectId: string;
  databaseId: string;
  error?: string;
} {
  const configured = isFirebaseServiceAccountConfigured();
  const app = configured ? getFirebaseAdminApp() : null;
  return {
    configured,
    initialized: Boolean(app),
    projectId: getFirebaseProjectId(),
    databaseId: getFirebaseDatabaseId(),
    ...(globalThis._nexoraAdminInitError ? { error: globalThis._nexoraAdminInitError } : {}),
  };
}
