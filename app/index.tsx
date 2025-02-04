import { Text, View } from "react-native";
import { initializeApp } from "firebase/app";

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

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Edit app/index.tsx to edit this screen.</Text>
    </View>
  );
}
