import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, FontFamily } from '@/constants/theme';

function TabItem({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconBg, focused && styles.iconBgActive]}>
        <Ionicons
          name={icon as any}
          size={22}
          color={focused ? Colors.secondary : Colors.onSurfaceVariant}
        />
      </View>
      {focused && <Text style={styles.tabLabel}>{label}</Text>}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.onSurfaceVariant,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabItem icon="home" label="Utama" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="peta"
        options={{
          tabBarIcon: ({ focused }) => <TabItem icon="map" label="Peta" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          tabBarIcon: ({ focused }) => <TabItem icon="trophy" label="Papan" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabItem icon="person" label="Profil" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    height: 64,
    backgroundColor: 'rgba(30,32,29,0.9)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.15)',
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: 'rgba(201,162,39,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBgActive: {
    backgroundColor: Colors.navyDark,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.secondary,
  },
});
