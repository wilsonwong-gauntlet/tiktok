import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter, useSegments } from 'expo-router';
import { auth } from '../services/firebase/index';
import { VideoSaveProvider } from '../contexts/VideoSaveContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const inAuthGroup = segments[0] === '(app)';
      
      if (user && !inAuthGroup) {
        // Redirect authenticated users to the home screen
        router.replace('/(app)/(tabs)');
      } else if (!user && inAuthGroup) {
        // Redirect unauthenticated users to the login screen
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [segments]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <VideoSaveProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="login" />
        </Stack>
      </VideoSaveProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
