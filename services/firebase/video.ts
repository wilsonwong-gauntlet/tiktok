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
  QueryDocumentSnapshot,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from './index';
import { Video, FurtherReading, VideoSummary } from '../../types/video';

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
          quiz: {
            id: 'ml-intro-quiz',
            videoId: 'intro-to-ml',
            questions: [
              {
                id: 'q1',
                question: 'What is the main difference between supervised and unsupervised learning?',
                options: [
                  'Supervised learning requires a GPU, unsupervised doesn\'t',
                  'Supervised learning uses labeled data, unsupervised learning doesn\'t',
                  'Supervised learning is faster than unsupervised learning',
                  'There is no difference between them'
                ],
                correctOptionIndex: 1,
                explanation: 'Supervised learning uses labeled data to train models, while unsupervised learning finds patterns in unlabeled data.'
              },
              {
                id: 'q2',
                question: 'Which of these is an example of supervised learning?',
                options: [
                  'Clustering customer groups',
                  'Finding anomalies in data',
                  'Email spam classification',
                  'Dimensionality reduction'
                ],
                correctOptionIndex: 2,
                explanation: 'Email spam classification is a supervised learning task because it uses labeled examples of spam and non-spam emails.'
              }
            ]
          },
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

  static async getSummary(videoId: string): Promise<VideoSummary | null> {
    try {
      const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) {
        return null;
      }

      const videoData = videoDoc.data();
      return videoData.summary || null;
    } catch (error) {
      console.error('Error getting video summary:', error);
      throw error;
    }
  }

  static async generateSummary(videoId: string): Promise<VideoSummary | null> {
    try {
      const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
      
      // For now, generate a mock summary
      // TODO: Integrate with actual AI service
      const mockSummary: VideoSummary = {
        key_points: [
          "First key point about the video content",
          "Second important point from the video",
          "Third significant takeaway"
        ],
        main_concepts: [
          "Primary Concept",
          "Secondary Concept",
          "Related Theory"
        ],
        generated_at: new Date()
      };

      // Save the summary to the video document
      await updateDoc(videoRef, {
        summary: mockSummary
      });

      return mockSummary;
    } catch (error) {
      console.error('Error generating video summary:', error);
      throw error;
    }
  }

  static async searchVideos(
    searchText: string,
    filters: {
      category?: string;
      tags?: string[];
    },
    sort: {
      field: 'createdAt' | 'viewCount';
      direction: 'asc' | 'desc';
    } = { field: 'createdAt', direction: 'desc' },
    lastVisible?: QueryDocumentSnapshot<any>
  ) {
    try {
      const videosRef = collection(db, VIDEOS_COLLECTION);
      const queryConstraints: any[] = [];

      // Add text search conditions
      if (searchText) {
        const lowercaseQuery = searchText.toLowerCase();
        queryConstraints.push(
          where('searchableText', 'array-contains', lowercaseQuery)
        );
      }

      // Add category filter
      if (filters.category) {
        queryConstraints.push(where('category', '==', filters.category));
      }

      // Add tags filter
      if (filters.tags && filters.tags.length > 0) {
        queryConstraints.push(where('tags', 'array-contains-any', filters.tags));
      }

      // Add sorting
      queryConstraints.push(orderBy(sort.field, sort.direction));

      // Add pagination
      if (lastVisible) {
        queryConstraints.push(startAfter(lastVisible));
      }
      queryConstraints.push(limit(VIDEOS_PER_PAGE));

      const videoQuery = query(videosRef, ...queryConstraints);
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
      console.error('Error searching videos:', error);
      throw error;
    }
  }

  static async getCategories(): Promise<string[]> {
    try {
      const videosRef = collection(db, VIDEOS_COLLECTION);
      const snapshot = await getDocs(videosRef);
      const categories = new Set<string>();
      
      snapshot.docs.forEach(doc => {
        const category = doc.data().category;
        if (category) {
          categories.add(category);
        }
      });

      return Array.from(categories).sort();
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  static async getTags(): Promise<string[]> {
    try {
      const videosRef = collection(db, VIDEOS_COLLECTION);
      const snapshot = await getDocs(videosRef);
      const tags = new Set<string>();
      
      snapshot.docs.forEach(doc => {
        const videoTags = doc.data().tags;
        if (Array.isArray(videoTags)) {
          videoTags.forEach(tag => tags.add(tag));
        }
      });

      return Array.from(tags).sort();
    } catch (error) {
      console.error('Error getting tags:', error);
      throw error;
    }
  }
} 