import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

export { app, db, storage };

// No need for auth initialization since Admin SDK has full access
export async function initializeAuth() {
  // Admin SDK has full access by default
  console.log('Using Firebase Admin SDK with full access');
} 