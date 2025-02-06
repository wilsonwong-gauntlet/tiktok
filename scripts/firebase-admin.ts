import * as admin from 'firebase-admin';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase/service-account.json');

if (!serviceAccount) {
  throw new Error('Firebase service account configuration is missing');
}

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "tiktok-3142f.firebasestorage.app"
});

// Initialize Firestore
const db = admin.firestore();

// Initialize Storage
const storage = admin.storage().bucket();

export { app, db, storage };

// No need for auth initialization since Admin SDK has full access
export async function initializeAuth() {
  // Admin SDK has full access by default
  console.log('Using Firebase Admin SDK with full access');
} 