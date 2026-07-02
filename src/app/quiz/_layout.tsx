import { Stack } from 'expo-router';

/**
 * Owns the inner-stack for quiz play / result screens.
 *
 * The root layout uses `<Slot />` (not `<Stack />`), so screens that live
 * outside a layout group can't inherit header options from a parent
 * Stack. We wrap `[level].tsx` and `result.tsx` in this Stack so we can
 * hide the header without polluting the root layout.
 */
export default function QuizLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[level]" />
      <Stack.Screen name="result" />
    </Stack>
  );
}
