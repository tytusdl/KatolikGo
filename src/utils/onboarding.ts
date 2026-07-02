import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDED_KEY = '@katolikgo_onboarded';

/**
 * Persist that the user has finished the onboarding flow so they
 * never see it again. Tolerant of storage failures — onboarding is
 * a UX nicety, never a hard gate.
 */
export async function markOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
  } catch (err) {
    console.warn('[onboarding] failed to set onboarded flag', err);
  }
}

export async function hasOnboarded(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(ONBOARDED_KEY);
    return flag === 'true';
  } catch {
    return false;
  }
}
