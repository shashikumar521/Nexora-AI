import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId,
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Persist authenticated sessions across page reloads and browser restarts
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Auth] Failed to configure local auth persistence:', err);
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

export function mapFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const message = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before finishing. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in request was cancelled because another sign-in window is active.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return `This domain (${window.location.hostname}) is not authorized in Firebase Authentication. Add it to Firebase Console -> Authentication -> Settings -> Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'Google Sign-In provider is not enabled in Firebase Authentication. Enable Google in Firebase Console -> Authentication -> Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error during Google sign-in. Check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This Google account has been disabled in Firebase Authentication.';
    default:
      return message || 'Failed to sign in with Google. Please try again.';
  }
}

export async function signInWithGoogle(): Promise<AuthUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const mapped = toAuthUser(result.user);
    if (!mapped) {
      throw new Error('Google sign-in did not return an authenticated account.');
    }
    return mapped;
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch (err) {
    console.warn('[Auth] Failed to obtain Firebase ID token:', err);
    return null;
  }
}

export function subscribeToAuthState(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, (firebaseUser) => {
    callback(toAuthUser(firebaseUser));
  });
}
