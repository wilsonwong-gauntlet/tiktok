import { initializeApp, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
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
  getDoc,
  addDoc,
  serverTimestamp,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { Video } from '../../types/video';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app;
try {
  app = getApp();
} catch {
  app = initializeApp(firebaseConfig);
}

// Initialize Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

const VIDEOS_PER_PAGE = 10;

async function fetchVideos(lastVisible?: any) {
  try {
    console.log('Fetching videos...');
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
    console.log('Snapshot size:', snapshot.size);
    const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    
    const videos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    })) as Video[];
    console.log('Processed videos:', videos.length);

    return {
      videos,
      lastVisible: lastVisibleDoc
    };
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}

async function fetchVideoById(videoId: string): Promise<Video | null> {
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

async function addSampleVideos() {
  try {
    const videosRef = collection(db, 'videos');
    const sampleVideos = [
      {
        title: 'Introduction to Machine Learning',
        description: 'A comprehensive overview of machine learning concepts and applications.',
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        duration: 120,
        createdAt: serverTimestamp(),
        category: 'Technology',
        tags: ['machine learning', 'AI', 'technology'],
        aiSummary: 'This video covers the basics of machine learning, including supervised and unsupervised learning.',
        furtherReading: [
          {
            title: 'Machine Learning Guide',
            url: 'https://example.com/ml-guide',
            description: 'A detailed guide to machine learning concepts'
          }
        ],
        viewCount: 0,
        authorId: 'sample-author',
        authorName: 'AI Learning Channel'
      },
      {
        title: 'Understanding Quantum Computing',
        description: 'Deep dive into quantum computing principles and applications.',
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnailUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
        duration: 180,
        createdAt: serverTimestamp(),
        category: 'Physics',
        tags: ['quantum computing', 'physics', 'technology'],
        aiSummary: 'An exploration of quantum computing fundamentals and their potential impact.',
        furtherReading: [
          {
            title: 'Quantum Computing Basics',
            url: 'https://example.com/quantum-guide',
            description: 'Introduction to quantum computing concepts'
          }
        ],
        viewCount: 0,
        authorId: 'sample-author',
        authorName: 'Quantum Physics Explained'
      }
    ];

    for (const video of sampleVideos) {
      await addDoc(videosRef, video);
    }

    console.log('Added sample videos successfully');
  } catch (error) {
    console.error('Error adding sample videos:', error);
    throw error;
  }
}

async function saveVideo(userId: string, videoId: string) {
  try {
    const savedRef = doc(db, 'users', userId, 'savedVideos', videoId);
    await setDoc(savedRef, {
      savedAt: serverTimestamp(),
      videoId
    });
  } catch (error) {
    console.error('Error saving video:', error);
    throw error;
  }
}

async function unsaveVideo(userId: string, videoId: string) {
  try {
    const savedRef = doc(db, 'users', userId, 'savedVideos', videoId);
    await deleteDoc(savedRef);
  } catch (error) {
    console.error('Error unsaving video:', error);
    throw error;
  }
}

async function fetchSavedVideos(userId: string) {
  try {
    const savedVideosRef = collection(db, 'users', userId, 'savedVideos');
    const savedQuery = query(savedVideosRef, orderBy('savedAt', 'desc'));
    const snapshot = await getDocs(savedQuery);
    
    const savedVideoIds = snapshot.docs.map(doc => doc.data().videoId);
    
    // Fetch the actual video documents
    const videos: Video[] = [];
    for (const videoId of savedVideoIds) {
      const video = await fetchVideoById(videoId);
      if (video) {
        videos.push(video);
      }
    }
    
    return videos;
  } catch (error) {
    console.error('Error fetching saved videos:', error);
    throw error;
  }
}

async function isVideoSaved(userId: string, videoId: string) {
  try {
    const savedRef = doc(db, 'users', userId, 'savedVideos', videoId);
    const savedDoc = await getDoc(savedRef);
    return savedDoc.exists();
  } catch (error) {
    console.error('Error checking if video is saved:', error);
    throw error;
  }
}

export { 
  app, 
  auth, 
  db,
  fetchVideos,
  fetchVideoById,
  addSampleVideos,
  saveVideo,
  unsaveVideo,
  fetchSavedVideos,
  isVideoSaved,
  storage
}; 