import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  startAfter,
  doc,
  getDoc
} from 'firebase/firestore';
import { Video } from '../types/video';

const firebaseConfig = {
  apiKey: "AIzaSyCA5xFRAu19FpUTFgXxzWWnyZ3_ZqOYpRs",
  authDomain: "tiktok-3142f.firebaseapp.com",
  projectId: "tiktok-3142f",
  storageBucket: "tiktok-3142f.firebasestorage.app",
  messagingSenderId: "733898101817",
  appId: "1:733898101817:web:2f28459bd9f0fb726d69e8"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);

const VIDEOS_PER_PAGE = 10;

export async function fetchVideos(lastVisible?: any) {
  try {
    const videosRef = collection(db, 'videos');
    let videoQuery = query(
      videosRef,
      orderBy('createdAt', 'desc'),
      limit(VIDEOS_PER_PAGE)
    );

    if (lastVisible) {
      videoQuery = query(
        videosRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limit(VIDEOS_PER_PAGE)
      );
    }

    const snapshot = await getDocs(videoQuery);
    const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    
    const videos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    })) as Video[];

    return {
      videos,
      lastVisible: lastVisibleDoc
    };
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}

export async function fetchVideoById(videoId: string): Promise<Video | null> {
  try {
    const videoRef = doc(db, 'videos', videoId);
    const videoDoc = await getDoc(videoRef);
    
    if (!videoDoc.exists()) {
      return null;
    }

    return {
      id: videoDoc.id,
      ...videoDoc.data(),
      createdAt: videoDoc.data().createdAt?.toDate()
    } as Video;
  } catch (error) {
    console.error('Error fetching video:', error);
    throw error;
  }
} 