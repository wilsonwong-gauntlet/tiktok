import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter, useSegments } from 'expo-router';
import { auth } from '../services/firebase/index';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const inAuthGroup = segments[0] === '(app)';
      
      if (user && !inAuthGroup) {
        // Redirect authenticated users to the home screen
        router.replace('/(app)/home');
      } else if (!user && inAuthGroup) {
        // Redirect unauthenticated users to the login screen
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}
