import {
  MPLUSRounded1c_400Regular,
  MPLUSRounded1c_500Medium,
  MPLUSRounded1c_700Bold,
  MPLUSRounded1c_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/m-plus-rounded-1c';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    MPLUSRounded1c_400Regular,
    MPLUSRounded1c_500Medium,
    MPLUSRounded1c_700Bold,
    MPLUSRounded1c_800ExtraBold,
  });
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    hydrate().catch((e) => {
      console.error('Failed to load data', e);
      useAppStore.setState({ hydrated: true });
    });
  }, [hydrate]);

  const ready = (fontsLoaded || !!fontError) && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppStack />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppStack() {
  const { c, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: fonts.bold, color: c.text },
          contentStyle: { backgroundColor: c.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="capture" options={{ title: 'Log a meal', presentation: 'modal' }} />
        <Stack.Screen name="handoff" options={{ title: 'Ask a chat app' }} />
        <Stack.Screen name="review" options={{ title: 'Review' }} />
        <Stack.Screen name="meal/[id]" options={{ title: 'Meal' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile & goal' }} />
      </Stack>
    </>
  );
}
