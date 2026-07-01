import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { onAuthChange, getUserData, autoLogin } from '@/services/authService';
import type { UserData } from '@/types';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  refreshUserData: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = async () => {
    if (user) {
      const data = await getUserData(user.uid);
      setUserData(data);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const unsubAuth = onAuthChange(async (firebaseUser) => {
        if (!mounted) return;
        setUser(firebaseUser);
        if (firebaseUser) {
          const data = await getUserData(firebaseUser.uid);
          if (mounted) setUserData(data);
        } else {
          if (mounted) setUserData(null);
        }
        if (mounted) setLoading(false);
      });

      const hasUser = auth.currentUser;
      if (!hasUser) {
        await autoLogin();
      }

      return () => {
        mounted = false;
        unsubAuth();
      };
    };

    init();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
