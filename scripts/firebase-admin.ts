import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase/service-account.json');

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
});

// Initialize Firestore
export const db = getFirestore();

// Initialize Storage
export const storage = getStorage().bucket();

// Export admin for FieldValue
import * as admin from 'firebase-admin';
export { admin };

// No need for auth initialization since Admin SDK has full access
export async function initializeAuth() {
  // Admin SDK has full access by default
  console.log('Using Firebase Admin SDK with full access');
} 