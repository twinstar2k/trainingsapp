import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  // true = eingeloggt, aber nicht auf der Zugangs-Allowlist (Private Beta).
  accessDenied: boolean;
  // true = eigener Allowlist-Eintrag trägt note == "Admin" → darf den Katalog pflegen.
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  accessDenied: false,
  isAdmin: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

// Context + Hook bewusst kolokiert; Auslagern würde durch ~10 Importstellen rippeln.
// react-refresh ist eine Hot-Reload-DX-Regel (keine Korrektheit) → hier deaktiviert.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAccessDenied(false);
      setIsAdmin(false);

      try {
        if (currentUser && db) {
          // Ensure user document exists
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              name: currentUser.displayName || '',
              email: currentUser.email || '',
              createdAt: Date.now(),
            });
          }

          // Rolle aus dem eigenen Allowlist-Eintrag lesen (Rules erlauben Self-Read).
          // note == "Admin" (case-insensitive) ⇒ Katalog-Pflege freigeschaltet.
          // Eigener try/catch: ein Fehler hier darf NIE den Zugang sperren — die Rolle
          // ist nur Komfort fürs UI; die Rules erzwingen die Schreibrechte ohnehin.
          const email = currentUser.email?.toLowerCase();
          if (email) {
            try {
              const allowSnap = await getDoc(doc(db, 'allowlist', email));
              setIsAdmin(String(allowSnap.data()?.note ?? '').toLowerCase() === 'admin');
            } catch (roleError) {
              console.error('Error reading allowlist role', roleError);
            }
          }
        }
      } catch (error) {
        // permission-denied = Konto nicht auf der Allowlist → Sperr-Seite statt Fehler-Kaskade.
        if ((error as { code?: string })?.code === 'permission-denied') {
          setAccessDenied(true);
        } else {
          console.error('Error ensuring user document', error);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      alert("Firebase is not configured. Please add the required environment variables.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      const code = (error as { code?: string })?.code;
      const message = error instanceof Error ? error.message : String(error);
      if (code === 'auth/unauthorized-domain') {
        alert(`Firebase Error: Unauthorized Domain.\n\nPlease add this domain to your Firebase Console:\n1. Go to Authentication > Settings > Authorized domains\n2. Add: ${window.location.hostname}`);
      } else {
        alert(`Error signing in: ${message}`);
      }
    }
  };

  const signOut = async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, accessDenied, isAdmin, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
