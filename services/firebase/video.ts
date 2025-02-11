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
  where,
  deleteDoc,
  arrayUnion,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './index';
import { Video, FurtherReading, VideoSummary, Quiz, CoachingPrompt, UserProgress } from '../../types/video';
import { getFunctions, httpsCallable } from 'firebase/functions';

const VIDEOS_PER_PAGE = 10;
const VIDEOS_COLLECTION = 'videos';

interface LocalVideoUpload {
  filePath: string;
  thumbnailPath: string;
  title: string;
  description: string;
  subjectId: string;      // Primary subject
  conceptIds: string[];   // Primary concepts
  relatedSubjects?: string[];
  tags: string[];
  authorId: string;
  authorName: string;
}

interface SmartSeekResult {
  timestamp: number;
  confidence: number;
  previewThumbnail?: string;
  context: string;
}

interface ChapterMarker {
  timestamp: number;
  title: string;
  summary: string;
}

async function updateStreak(userId: string) {
  try {
    console.log('🔥 Updating streak for user:', userId);
    const userProgressRef = doc(db, 'users', userId, 'progress', 'learning');
    const userProgressDoc = await getDoc(userProgressRef);
    const userProgress = userProgressDoc.data() as UserProgress;
    
    console.log('Current user progress:', userProgress);
    
    const now = Timestamp.now();
    const lastActivityTimestamp = userProgress?.streak?.lastActivityDate;
    
    // If this is their first activity or no streak object
    if (!lastActivityTimestamp) {
      console.log('First activity or no streak - initializing streak');
      await updateDoc(userProgressRef, {
        streak: {
          currentStreak: 1,
          lastActivityDate: now,
          longestStreak: 1
        }
      });
      return;
    }

    // Check if they're maintaining their streak (activity within last 24 hours)
    const hoursSinceLastActivity = (now.toMillis() - lastActivityTimestamp.toMillis()) / (1000 * 60 * 60);
    console.log('Hours since last activity:', hoursSinceLastActivity);
    
    if (hoursSinceLastActivity <= 24) {
      // Maintain streak
      const currentStreak = userProgress.streak.currentStreak;
      console.log('Maintaining streak at:', currentStreak);
      await updateDoc(userProgressRef, {
        streak: {
          currentStreak,
          lastActivityDate: now,
          longestStreak: Math.max(currentStreak, userProgress.streak.longestStreak)
        }
      });
    } else if (hoursSinceLastActivity <= 48) {
      // They're within the grace period (next day)
      const newStreak = userProgress.streak.currentStreak + 1;
      console.log('Within grace period - incrementing streak to:', newStreak);
      await updateDoc(userProgressRef, {
        streak: {
          currentStreak: newStreak,
          lastActivityDate: now,
          longestStreak: Math.max(newStreak, userProgress.streak.longestStreak)
        }
      });
    } else {
      // Streak broken
      console.log('Streak broken - resetting to 1');
      await updateDoc(userProgressRef, {
        streak: {
          currentStreak: 1,
          lastActivityDate: now,
          longestStreak: userProgress.streak.longestStreak
        }
      });
    }
  } catch (error) {
    console.error('Error updating streak:', error);
  }
}

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
      
      console.log('\nDetailed video documents:');
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`\nVideo ID: ${doc.id}`);
        console.log(`Title: ${data.title}`);
        console.log(`URL: ${data.url}`);
        console.log(`Format: ${data.format || 'not specified'}`);
        console.log(`Created At: ${data.createdAt?.toDate?.()}`);
      });
      
      const videos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Video[];
      console.log('\nProcessed videos:', videos.length);

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
          searchableText: [
            'introduction',
            'machine',
            'learning',
            'comprehensive',
            'overview',
            'concepts',
            'applications',
            'technology',
            'ai',
            'artificial',
            'intelligence',
            'supervised',
            'unsupervised'
          ],
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
          authorName: 'AI Learning Channel',
          subjectId: 'VRtalTBPzBiqRkFeEilq',
          conceptIds: ['sys-001', 'sys-002']
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
          searchableText: [
            'understanding',
            'quantum',
            'computing',
            'deep',
            'dive',
            'principles',
            'applications',
            'physics',
            'technology',
            'fundamentals',
            'impact'
          ],
          furtherReading: [
            {
              title: 'Quantum Computing Basics',
              url: 'https://example.com/quantum-guide',
              description: 'Introduction to quantum computing concepts'
            }
          ],
          viewCount: 0,
          authorId: 'sample-author',
          authorName: 'Quantum Physics Explained',
          subjectId: 'VRtalTBPzBiqRkFeEilq',
          conceptIds: ['sys-002', 'sys-003']
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
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) {
        throw new Error('Video not found');
      }

      const videoData = videoDoc.data();
      
      // Check if transcription is available
      if (!videoData.transcription || videoData.transcriptionStatus !== 'completed') {
        throw new Error('Video transcription is not available');
      }

      // Call the Cloud Function
      const functions = getFunctions();
      const generateVideoSummary = httpsCallable<
        { videoId: string; transcription: string },
        VideoSummary
      >(functions, 'generateVideoSummary');
      
      const result = await generateVideoSummary({ 
        videoId,
        transcription: videoData.transcription 
      });
      
      const summary = result.data;
      
      // Update the video document with the new summary
      await updateDoc(videoRef, {
        summary: {
          ...summary,
          generated_at: new Date()
        }
      });

      return summary;
    } catch (error) {
      console.error('Error generating video summary:', error);
      throw error;
    }
  }

  static async searchVideos(
    searchText: string,
    filters: {
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

  static async clearVideos() {
    try {
      const videosRef = collection(db, VIDEOS_COLLECTION);
      const snapshot = await getDocs(videosRef);
      
      // Delete both Firestore documents and Storage files
      const deletePromises = snapshot.docs.map(async (doc) => {
        const videoData = doc.data();
        const videoUrl = videoData.url;
        const thumbnailUrl = videoData.thumbnailUrl;

        // Extract file paths from URLs
        const videoPath = decodeURIComponent(videoUrl.split('/o/')[1].split('?')[0]);
        const thumbnailPath = decodeURIComponent(thumbnailUrl.split('/o/')[1].split('?')[0]);

        // Delete files from Storage
        try {
          const videoRef = ref(storage, videoPath);
          const thumbnailRef = ref(storage, thumbnailPath);
          await Promise.all([
            deleteObject(videoRef),
            deleteObject(thumbnailRef)
          ]);
          console.log(`Deleted storage files for video ${doc.id}`);
        } catch (error) {
          console.warn(`Failed to delete storage files for video ${doc.id}:`, error);
        }

        // Delete Firestore document
        await deleteDoc(doc.ref);
        console.log(`Deleted Firestore document ${doc.id}`);
      });

      await Promise.all(deletePromises);
      console.log('Cleared all videos successfully');
    } catch (error) {
      console.error('Error clearing videos:', error);
      throw error;
    }
  }

  static async uploadLocalVideo(videoData: LocalVideoUpload): Promise<string> {
    try {
      // Create a reference to the video file in Firebase Storage
      const videoFileName = `videos/${Date.now()}-${videoData.filePath.split('/').pop()}`;
      const videoRef = ref(storage, videoFileName);

      // Create a reference to the thumbnail in Firebase Storage
      const thumbnailFileName = `thumbnails/${Date.now()}-${videoData.thumbnailPath.split('/').pop()}`;
      const thumbnailRef = ref(storage, thumbnailFileName);

      // Read and upload the video file with proper content type
      const videoResponse = await fetch(`file://${videoData.filePath}`);
      const videoBlob = await videoResponse.blob();
      const videoExtension = videoData.filePath.split('.').pop()?.toLowerCase();
      const videoContentType = videoExtension === 'webm' ? 'video/webm' : 
                              videoExtension === 'mp4' ? 'video/mp4' : 
                              'video/mp4';

      await uploadBytes(videoRef, videoBlob, {
        contentType: videoContentType
      });

      // Read and upload the thumbnail
      const thumbnailResponse = await fetch(`file://${videoData.thumbnailPath}`);
      const thumbnailBlob = await thumbnailResponse.blob();
      await uploadBytes(thumbnailRef, thumbnailBlob, {
        contentType: 'image/jpeg'
      });

      // Get the download URLs
      const [videoUrl, thumbnailUrl] = await Promise.all([
        getDownloadURL(videoRef),
        getDownloadURL(thumbnailRef)
      ]);

      // Create a video document in Firestore
      const videosRef = collection(db, VIDEOS_COLLECTION);
      const videoDoc = {
        title: videoData.title,
        description: videoData.description,
        url: videoUrl,
        thumbnailUrl: thumbnailUrl,
        duration: 0, // TODO: Get video duration
        createdAt: serverTimestamp(),
        subjectId: videoData.subjectId,
        conceptIds: videoData.conceptIds,
        relatedSubjects: videoData.relatedSubjects || [],
        tags: videoData.tags,
        searchableText: [
          ...videoData.title.toLowerCase().split(' '),
          ...videoData.description.toLowerCase().split(' '),
          ...videoData.tags.map(tag => tag.toLowerCase())
        ],
        viewCount: 0,
        authorId: videoData.authorId,
        authorName: videoData.authorName,
        format: videoContentType
      };

      const docRef = await addDoc(videosRef, videoDoc);
      return docRef.id;
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error;
    }
  }

  static async addLocalVideos(videos: LocalVideoUpload[]) {
    try {
      const uploadPromises = videos.map(video => this.uploadLocalVideo(video));
      const videoIds = await Promise.all(uploadPromises);
      return videoIds;
    } catch (error) {
      console.error('Error adding local videos:', error);
      throw error;
    }
  }

  static async validateAndCleanupVideos() {
    try {
      const videosRef = collection(db, VIDEOS_COLLECTION);
      const snapshot = await getDocs(videosRef);
      
      console.log('\nStarting video validation...');
      const cleanupPromises = snapshot.docs.map(async (doc) => {
        const videoData = doc.data();
        const videoUrl = videoData.url;
        console.log(`\nChecking video document ${doc.id}:`);
        console.log(`Title: ${videoData.title}`);
        console.log(`URL: ${videoUrl}`);

        try {
          // Extract storage path from URL
          const videoPath = decodeURIComponent(videoUrl.split('/o/')[1].split('?')[0]);
          console.log(`Storage path: ${videoPath}`);

          // Check if file exists in storage
          const videoRef = ref(storage, videoPath);
          try {
            await getDownloadURL(videoRef);
            console.log('Video file exists in storage');
            return false; // Document is valid
          } catch (storageError) {
            if ((storageError as any)?.code === 'storage/object-not-found') {
              console.log('Video file not found in storage, deleting document...');
              await deleteDoc(doc.ref);
              return true; // Document was deleted
            } else {
              console.error('Storage error:', storageError);
              return false;
            }
          }
        } catch (error) {
          console.error(`Error processing document ${doc.id}:`, error);
          return false;
        }
      });

      const results = await Promise.all(cleanupPromises);
      const deletedCount = results.filter(Boolean).length;
      console.log(`\nCleanup complete. Removed ${deletedCount} invalid video documents`);
    } catch (error) {
      console.error('Error validating videos:', error);
      throw error;
    }
  }

  static async clearSummaries() {
    try {
      const videosRef = collection(db, VIDEOS_COLLECTION);
      const snapshot = await getDocs(videosRef);
      
      const clearPromises = snapshot.docs.map(async (doc) => {
        await updateDoc(doc.ref, {
          summary: null,
          aiSummary: null // Clear the old field as well
        });
      });

      await Promise.all(clearPromises);
      console.log('Cleared all summaries successfully');
    } catch (error) {
      console.error('Error clearing summaries:', error);
      throw error;
    }
  }

  static async getVideosBySubject(subjectId: string): Promise<Video[]> {
    try {
      const videosRef = collection(db, 'videos');
      const q = query(videosRef, where('subjectId', '==', subjectId));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      } as Video));
    } catch (error) {
      console.error('Error getting videos by subject:', error);
      throw error;
    }
  }

  static async getVideosByConcept(conceptId: string): Promise<Video[]> {
    try {
      const videosRef = collection(db, VIDEOS_COLLECTION);
      const q = query(
        videosRef,
        where('conceptIds', 'array-contains', conceptId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Video[];
    } catch (error) {
      console.error('Error fetching videos by concept:', error);
      throw error;
    }
  }

  static async getSavedVideoIds(userId: string): Promise<string[]> {
    try {
      // Get the savedVideos subcollection
      const savedVideosRef = collection(db, 'users', userId, 'savedVideos');
      const snapshot = await getDocs(savedVideosRef);
      
      console.log('Saved videos snapshot:', {
        size: snapshot.size,
        docs: snapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }))
      });

      // Extract video IDs from the documents
      return snapshot.docs.map(doc => doc.data().videoId);
    } catch (error) {
      console.error('Error fetching saved video IDs:', error);
      throw error;
    }
  }

  static async generateQuiz(videoId: string): Promise<Quiz | null> {
    try {
      const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) {
        throw new Error('Video not found');
      }

      const videoData = videoDoc.data();
      
      // Check if transcription is available
      if (!videoData.transcription || videoData.transcriptionStatus !== 'completed') {
        throw new Error('Video transcription is not available');
      }

      // Call the Cloud Function
      const functions = getFunctions();
      const generateQuizFunc = httpsCallable<
        { videoId: string; transcription: string },
        Quiz
      >(functions, 'generateQuiz');
      
      const result = await generateQuizFunc({ 
        videoId,
        transcription: videoData.transcription 
      });
      
      const quiz = result.data;
      
      // Update the video document with the new quiz
      await updateDoc(videoRef, {
        quiz: quiz
      });

      return quiz;
    } catch (error) {
      console.error('Error generating quiz:', error);
      throw error;
    }
  }

  static async generateCoachingPrompts(videoId: string): Promise<CoachingPrompt[]> {
    try {
      const functions = getFunctions();
      const generatePrompts = httpsCallable<
        { videoId: string },
        { success: boolean; reason?: string; prompts?: CoachingPrompt[] }
      >(functions, 'generateCoachingPrompts');
      
      const result = await generatePrompts({ videoId });
      
      if (!result.data.success) {
        throw new Error(result.data.reason || 'Failed to generate coaching prompts');
      }
      
      return result.data.prompts || [];
    } catch (error) {
      console.error('Error generating coaching prompts:', error);
      throw error;
    }
  }

  static async markVideoCompleted(userId: string, videoId: string, subjectId: string) {
    try {
      console.log('📹 Marking video as completed:', { userId, videoId, subjectId });
      const userProgressRef = doc(db, 'users', userId, 'progress', 'learning');
      const userProgressDoc = await getDoc(userProgressRef);
      
      // Initialize user progress if it doesn't exist
      if (!userProgressDoc.exists()) {
        console.log('Creating new user progress document');
        const now = Timestamp.now();
        const initialProgress = {
          userId,
          subjects: {
            [subjectId]: {
              progress: 0,
              lastActivity: now,
              completedVideos: [videoId],
              masteredConcepts: [],
              quizScores: {},
              reflections: []
            }
          },
          streak: {
            currentStreak: 1,
            lastActivityDate: now,
            longestStreak: 1
          },
          totalStudyTime: 0,
          weeklyGoals: {
            target: 10,
            achieved: 0
          }
        };
        await setDoc(userProgressRef, initialProgress);
        console.log('Created initial progress:', initialProgress);
        return;
      }

      const userProgress = userProgressDoc.data() as UserProgress;
      console.log('Existing user progress:', userProgress);

      // Initialize subject if it doesn't exist
      if (!userProgress.subjects[subjectId]) {
        console.log('Initializing new subject:', subjectId);
        userProgress.subjects[subjectId] = {
          progress: 0,
          lastActivity: Timestamp.now(),
          completedVideos: [],
          masteredConcepts: [],
          quizScores: {},
          reflections: []
        };
      }

      // Add video to completed videos if not already there
      if (!userProgress.subjects[subjectId].completedVideos.includes(videoId)) {
        console.log('Adding video to completed videos');
        // Update subject data
        await updateDoc(userProgressRef, {
          [`subjects.${subjectId}.completedVideos`]: arrayUnion(videoId),
          [`subjects.${subjectId}.lastActivity`]: serverTimestamp()
        });
        console.log('Updated completed videos');

        // Update streak in a separate operation to ensure atomic update
        await updateStreak(userId);
        console.log('Updated streak');
      } else {
        console.log('Video already marked as completed');
      }
    } catch (error) {
      console.error('Error marking video as completed:', error);
      throw error;
    }
  }

  static async smartSeek(videoId: string, query: string): Promise<SmartSeekResult[]> {
    try {
      console.log('VideoService: Starting smartSeek', { videoId, query });
      const functions = getFunctions();
      const smartSeekFunc = httpsCallable<
        { videoId: string; query: string },
        { results: SmartSeekResult[] }
      >(functions, 'smartSeek');
      
      // First try with existing segments
      const result = await smartSeekFunc({ videoId, query });
      console.log('VideoService: SmartSeek result:', result.data);

      // If no results and we have transcription, try searching in full text
      if (result.data.results.length === 0) {
        const videoDoc = await this.fetchVideoById(videoId);
        if (videoDoc?.transcription) {
          // Split transcription into sentences
          const sentences = videoDoc.transcription.match(/[^.!?]+[.!?]+/g) || [];
          const avgDuration = (videoDoc.duration || 60) / sentences.length;
          
          // Search in sentences
          const results: SmartSeekResult[] = [];
          sentences.forEach((sentence, index) => {
            if (sentence.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                timestamp: index * avgDuration,
                confidence: 0.7,
                context: sentence.trim(),
              });
            }
          });
          
          console.log('VideoService: Found results in full transcription:', results);
          return results;
        }
      }

      return result.data.results;
    } catch (error) {
      console.error('VideoService: Error in smartSeek:', error);
      throw error;
    }
  }

  static async generateChapterMarkers(videoId: string): Promise<ChapterMarker[]> {
    try {
      const functions = getFunctions();
      const generateChapters = httpsCallable<
        { videoId: string },
        { chapters: ChapterMarker[] }
      >(functions, 'generateChapterMarkers');
      
      const result = await generateChapters({ videoId });
      
      // Update video document with chapter markers
      const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
      await updateDoc(videoRef, {
        chapterMarkers: result.data.chapters
      });
      
      return result.data.chapters;
    } catch (error) {
      console.error('Error generating chapter markers:', error);
      throw error;
    }
  }
} 