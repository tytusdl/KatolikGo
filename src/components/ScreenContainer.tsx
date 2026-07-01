import { View, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}

export function ScreenContainer({ children, scroll = false, style }: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  if (scroll) {
    return (
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 16, paddingHorizontal: 16 }}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
  },
});
