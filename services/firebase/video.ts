import { 
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
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Video, FurtherReading } from '../../types/video';

const VIDEOS_PER_PAGE = 10;
const VIDEOS_COLLECTION = 'videos';

export class VideoService {
  static async fetchVideos(lastVisible?: QueryDocumentSnapshot<any>) {
    try {
      console.log('Fetching videos...');
      const videosRef = collection(db, VIDEOS_COLLECTION);
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

  static async fetchVideoById(videoId: string): Promise<Video | null> {
    try {
      const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
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

  static async addSampleVideos() {
    try {
      const videosRef = collection(db, VIDEOS_COLLECTION);
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
} 