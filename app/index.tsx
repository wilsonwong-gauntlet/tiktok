import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCA5xFRAu19FpUTFgXxzWWnyZ3_ZqOYpRs",
  authDomain: "tiktok-3142f.firebaseapp.com",
  projectId: "tiktok-3142f",
  storageBucket: "tiktok-3142f.firebasestorage.app",
  messagingSenderId: "733898101817",
  appId: "1:733898101817:web:2f28459bd9f0fb726d69e8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/(app)/home');
      } else {
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#FF0050" />
    </View>
  );
}
