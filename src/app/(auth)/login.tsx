import AuthScreen from '@/components/AuthScreen';

/**
 * /login — renders the shared AuthScreen with the Log Masuk tab active
 * by default. The actual dark-themed UI, tabs, social sign-in, and
 * guest flow all live in `components/AuthScreen.tsx`.
 *
 * This file exists so deep links to `/login` and AuthGate's pathname
 * check (`pathname === '/login' || '/register'`) keep working — both
 * routes render the same component, the only difference is the
 * initial tab.
 */
export default function LoginScreen() {
  return <AuthScreen defaultTab="login" />;
}