import { useEffect } from 'react';
import { Stack, Slot } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const auth = getAuth();

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
  }, [auth, segments]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(app)/home"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
