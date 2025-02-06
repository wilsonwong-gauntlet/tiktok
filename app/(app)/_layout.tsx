import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="subject/[id]" 
        options={{
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="concept/[id]" 
        options={{
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="video/[id]" 
        options={{
          headerShown: false,
          presentation: 'modal'
        }} 
      />
    </Stack>
  );
} 