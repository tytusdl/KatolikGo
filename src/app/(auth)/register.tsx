import AuthScreen from '@/components/AuthScreen';

/**
 * /register — renders the shared AuthScreen with the Daftar tab active
 * by default. See `login.tsx` and `components/AuthScreen.tsx` for the
 * full UI + auth flow. This file is intentionally a thin wrapper so
 * deep links to `/register` still land the user on the register form.
 */
export default function RegisterScreen() {
  return <AuthScreen defaultTab="register" />;
}