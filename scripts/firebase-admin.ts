import * as admin from 'firebase-admin';
import { resolve } from 'path';

const serviceAccountPath = resolve(__dirname, '../config/firebase/service-account.json');

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  storageBucket: "tiktok-3142f.firebasestorage.app"
});

export const db = admin.firestore();
export const storage = admin.storage().bucket();

// No need for auth initialization since Admin SDK has full access
export async function initializeAuth() {
  // Admin SDK has full access by default
  console.log('Using Firebase Admin SDK with full access');
} 