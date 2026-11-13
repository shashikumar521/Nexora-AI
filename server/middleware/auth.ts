import { createVerify } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import {
  getFirebaseAdminAuth,
  getFirebaseProjectId,
} from '../lib/firebaseAdmin.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
  idToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const GOOGLE_SECURETOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> = {};
let certsExpiresAtMs = 0;
let certsFetchPromise: Promise<Record<string, string>> | null = null;

function parseBase64UrlJson<T = Record<string, unknown>>(segment: string): T {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const decoded = Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
  return JSON.parse(decoded) as T;
}

function parseBase64UrlBuffer(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

function parseMaxAgeSeconds(cacheControl: string | null): number {
  if (!cacheControl) return 3600;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return 3600;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 60 ? parsed : 3600;
}

async function getGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && now < certsExpiresAtMs && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }

  if (certsFetchPromise && !forceRefresh) {
    return certsFetchPromise;
  }

  certsFetchPromise = (async () => {
    const res = await fetch(GOOGLE_SECURETOKEN_CERTS_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch Google public certificates (HTTP ${res.status}).`);
    }
    const certs = (await res.json()) as Record<string, string>;
    const maxAgeSec = parseMaxAgeSeconds(res.headers.get('cache-control'));
    cachedCerts = certs;
    certsExpiresAtMs = Date.now() + maxAgeSec * 1000;
    return certs;
  })().finally(() => {
    certsFetchPromise = null;
  });

  return certsFetchPromise;
}

export class AuthVerificationError extends Error {
  readonly code: 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'AUTH_INVALID';
  readonly httpStatus: number;

  constructor(
    message: string,
    code: 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'AUTH_INVALID' = 'AUTH_INVALID',
    httpStatus = 401
  ) {
    super(message);
    this.name = 'AuthVerificationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Cryptographically verify a Firebase ID Token and extract the authoritative Firebase UID.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<AuthenticatedUser> {
  const token = idToken.trim();
  if (!token) {
    throw new AuthVerificationError('Authentication required.', 'AUTH_REQUIRED', 401);
  }

  const adminAuth = getFirebaseAdminAuth();
  if (adminAuth) {
    try {
      const decoded = await adminAuth.verifyIdToken(token, false);
      return {
        uid: decoded.uid,
        email: typeof decoded.email === 'string' ? decoded.email : undefined,
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
        picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
        emailVerified: Boolean(decoded.email_verified),
        idToken: token,
      };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code.includes('expired')) {
        throw new AuthVerificationError('Session expired. Please sign in again.', 'AUTH_EXPIRED', 401);
      }
      throw new AuthVerificationError('Invalid authentication token.', 'AUTH_INVALID', 401);
    }
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthVerificationError('Malformed authentication token.', 'AUTH_INVALID', 401);
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;

  try {
    header = parseBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
    payload = parseBase64UrlJson<Record<string, unknown>>(payloadB64);
  } catch {
    throw new AuthVerificationError('Invalid authentication token encoding.', 'AUTH_INVALID', 401);
  }

  if (header.alg !== 'RS256' || !header.kid || typeof header.kid !== 'string') {
    throw new AuthVerificationError('Unsupported authentication token algorithm.', 'AUTH_INVALID', 401);
  }

  let certs = await getGooglePublicCerts(false);
  let pem = certs[header.kid];
  if (!pem) {
    certs = await getGooglePublicCerts(true);
    pem = certs[header.kid];
  }
  if (!pem) {
    throw new AuthVerificationError('Invalid authentication key identifier.', 'AUTH_INVALID', 401);
  }

  const signature = parseBase64UrlBuffer(sigB64);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  if (!verifier.verify(pem, signature)) {
    throw new AuthVerificationError('Invalid authentication signature.', 'AUTH_INVALID', 401);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const clockSkewSec = 30;
  const projectId = getFirebaseProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : 0;
  const aud = typeof payload.aud === 'string' ? payload.aud : '';
  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';

  if (!exp || exp + clockSkewSec <= nowSec) {
    throw new AuthVerificationError('Your session has expired. Please sign in again.', 'AUTH_EXPIRED', 401);
  }
  if (!iat || iat - 300 > nowSec) {
    throw new AuthVerificationError('Token issued-at timestamp is invalid.', 'AUTH_INVALID', 401);
  }
  if (authTime && authTime - 300 > nowSec) {
    throw new AuthVerificationError('Token auth_time timestamp is invalid.', 'AUTH_INVALID', 401);
  }
  if (!projectId || aud !== projectId || iss !== expectedIssuer) {
    throw new AuthVerificationError('Token project audience or issuer mismatch.', 'AUTH_INVALID', 401);
  }
  if (!sub || sub.length > 128) {
    throw new AuthVerificationError('Token missing valid subject UID.', 'AUTH_INVALID', 401);
  }

  return {
    uid: sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    emailVerified: Boolean(payload.email_verified),
    idToken: token,
  };
}

/**
 * Express middleware that requires a valid Firebase ID token in the Authorization Bearer header.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Please sign in with Google.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please sign in with Google.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  try {
    req.user = await verifyFirebaseIdToken(token);
    next();
  } catch (err: unknown) {
    if (err instanceof AuthVerificationError) {
      res.status(err.httpStatus).json({ error: err.message, code: err.code });
      return;
    }
    console.error('[Auth] Unexpected error verifying Firebase ID token:', err instanceof Error ? err.message : err);
    res.status(401).json({ error: 'Authentication verification failed.', code: 'AUTH_INVALID' });
  }
}
