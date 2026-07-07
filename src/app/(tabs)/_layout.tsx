import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius } from '@/constants/theme';
import { Platform, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// v2 "Brain Rush" — Floating-pill tab bar.
//
// Per mockups/mymock.html v2 tab system (lines 217-299):
//   - Floating pill that sits 12px above the bottom edge with side
//     margins (14px each). White surface, 24px corner radius.
//   - Each tab item: column with 36×36 rounded-square icon background
//     and a small (9px) label below.
//   - Active state: icon background flips to saturated blue
//     (`Colors.primary`), icon color goes white, label flips to blue.
//   - Subtle press scale on tap (handled by expo-router's built-in
//     active-opacity).
//
// Implementation notes:
//   - expo-router's `<Tabs>` `tabBarStyle` can't render a custom
//     shadow / pill chrome directly via the documented props — we
//     use the documented `tabBarStyle.backgroundColor: 'white'` +
//     `borderRadius` + `position: 'absolute'` combo to get close to
//     the mockup. The "fully custom floating pill" look from the
//     HTML mockup would need a custom tab-bar component (out of
//     scope here); this config gets the same visual identity
//     (white pill, rounded corners, blue active state, icon+label
//     layout) without rebuilding the tab bar from scratch.
//   - `tabBarShowLabel: false` is required so expo-router doesn't
//     render its own label below our layout — our custom label lives
//     inside the icon column.
// ---------------------------------------------------------------------------

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Height math mirrors the previous layout so the screens' bottom
  // spacers still clear the floating pill correctly.
  const tabBarHeight = Platform.OS === 'ios' ? 72 : 64;
  const tabBarPaddingBottom = Platform.OS === 'ios'
    ? Math.max(insets.bottom, 8)
    : Math.max(insets.bottom, 16);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hide expo-router's built-in label — our custom label lives
        // inside the icon column.
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          // Floating pill: white surface, 24px radius, lifted via shadow.
          backgroundColor: Colors.white,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          height: tabBarHeight + tabBarPaddingBottom,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
          paddingHorizontal: 8,
          marginHorizontal: 14,
          marginBottom: Platform.OS === 'ios' ? Math.max(insets.bottom - 8, 8) : 12,
          borderRadius: BorderRadius.xl,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          // Floating-pill shadow — softer + deeper than the previous
          // tab bar shadow to match the v2 mockup's "lifted card" feel.
          shadowColor: '#142850',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 8,
        },
        tabBarItemStyle: {
          // Each tab column gets a centered icon + label stack.
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Utama',
          tabBarIcon: ({ color, focused }) => (
            <TabItem
              icon="home"
              label="Utama"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Kuiz',
          tabBarIcon: ({ color, focused }) => (
            <TabItem
              icon="school"
              label="Kuiz"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Papan',
          tabBarIcon: ({ color, focused }) => (
            <TabItem
              icon="trophy"
              label="Papan"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabItem
              icon="person"
              label="Profil"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// TabItem — icon+label column that renders the v2 active-state styling.
//   - Icon background: 36×36 rounded square. Transparent when inactive,
//     saturated blue (`Colors.primary`) when active.
//   - Icon color: text-secondary when inactive, white when active.
//   - Label: 9px Nunito-weight-800 below the icon, navy when inactive,
//     blue when active.
// ---------------------------------------------------------------------------
interface TabItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  focused: boolean;
}

function TabItem({ icon, label, color, focused }: TabItemProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: focused ? Colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          // Active-state shadow — small blue glow under the icon to
          // match the v2 mockup's lifted-tab feel.
          ...(focused
            ? {
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }
            : null),
        }}
      >
        <Ionicons
          name={icon}
          size={20}
          color={focused ? Colors.white : color}
        />
      </View>
      <Text
        style={{
          fontSize: 9,
          fontWeight: '800',
          color: focused ? Colors.primary : '#6b7280',
          marginTop: 2,
          letterSpacing: 0.3,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}