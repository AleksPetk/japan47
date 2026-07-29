import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/auth-context';
import { colors, typography } from '@/constants/theme';

export default function RootLayout() {
  return <AuthProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.paper },
      headerTintColor: colors.ink,
      headerTitleStyle: { fontFamily: typography.title, fontWeight: '700' },
      headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: colors.paper },
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="regions/index" options={{ title: 'Regions' }} />
      <Stack.Screen name="regions/[name]" options={{ title: 'Region' }} />
      <Stack.Screen name="prefectures/index" options={{ title: 'Prefectures' }} />
      <Stack.Screen name="prefectures/[name]" options={{ title: 'Prefecture' }} />
      <Stack.Screen name="places/index" options={{ title: 'Places' }} />
      <Stack.Screen name="places/[id]" options={{ title: 'Place' }} />
      <Stack.Screen name="places/form" options={{ title: 'Suggest a place', presentation: 'modal' }} />
      <Stack.Screen name="reviews/form" options={{ title: 'Review', presentation: 'modal' }} />
      <Stack.Screen name="contributors/[id]" options={{ title: 'Contributor' }} />
      <Stack.Screen name="auth/login" options={{ title: 'Sign in', presentation: 'modal' }} />
      <Stack.Screen name="auth/register" options={{ title: 'Create account', presentation: 'modal' }} />
      <Stack.Screen name="auth/check-email" options={{ title: 'Check your email' }} />
      <Stack.Screen name="auth/forgot-password" options={{ title: 'Reset password', presentation: 'modal' }} />
      <Stack.Screen name="auth/verify" options={{ title: 'Verify email' }} />
      <Stack.Screen name="auth/reset-password" options={{ title: 'Choose a new password' }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Account settings', presentation: 'modal' }} />
      <Stack.Screen name="contact" options={{ title: 'Contact Japan47', presentation: 'modal' }} />
      <Stack.Screen name="support" options={{ title: 'Support Japan47' }} />
    </Stack>
  </AuthProvider>;
}
