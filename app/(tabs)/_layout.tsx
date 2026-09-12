import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme/tokens';
import { Icon } from '@/components/Icon';

// Fünf Tabs. Scan ist der erhobene Terrakotta-Button in der Mitte — die wichtigste Aktion.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 78, paddingBottom: 10 },
      tabBarActiveTintColor: colors.text,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10.5 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Karte', tabBarIcon: ({ color }) => <Icon name="pin" color={color} /> }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: ({ color }) => <Icon name="play" color={color} /> }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: () => (
        <View style={s.scan}><Icon name="scan" color="#fff" size={24} /></View>) }} />
      <Tabs.Screen name="saved" options={{ title: 'Gespeichert', tabBarIcon: ({ color }) => <Icon name="heart" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color }) => <Icon name="user" color={color} /> }} />
    </Tabs>
  );
}
const s = StyleSheet.create({
  scan: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: -30,
    shadowColor: colors.accent, shadowOpacity: .45, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
