import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/constants/theme';

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  function TabIcon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  }
  return TabIcon;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const androidBottomPadding = Math.max(insets.bottom, 20) + spacing.xs;

  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.paper },
    headerShadowVisible: false,
    headerTintColor: colors.ink,
    headerTitleStyle: { fontFamily: typography.title, fontWeight: '700', fontSize: 20 },
    tabBarActiveTintColor: colors.red,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.line,
      height: Platform.OS === 'android' ? 64 + androidBottomPadding : 84,
      paddingTop: 7,
      paddingBottom: Platform.OS === 'android' ? androidBottomPadding : 20,
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Japan47', tabBarLabel: 'Home', tabBarIcon: tabIcon('home-outline') }} />
    <Tabs.Screen name="explore" options={{ title: 'Explore Japan', tabBarLabel: 'Explore', tabBarIcon: tabIcon('compass-outline') }} />
    <Tabs.Screen name="travel" options={{ title: 'My Travel', tabBarLabel: 'My Travel', tabBarIcon: tabIcon('heart-outline') }} />
    <Tabs.Screen name="profile" options={{ title: 'Community', tabBarLabel: 'Profile', tabBarIcon: tabIcon('person-outline') }} />
  </Tabs>;
}
