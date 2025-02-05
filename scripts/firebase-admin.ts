import * as admin from 'firebase-admin';
import { join } from 'path';

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase/service-account.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "tiktok-3142f.firebasestorage.app"
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