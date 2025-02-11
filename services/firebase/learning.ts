import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  updateDoc,
  limit
} from 'firebase/firestore';
import { db, auth } from './index';
import { Note, Quiz, QuizAttempt, LearningConcept, RetentionPrompt, UserProgress, LearningPreferences, LearningPath, ConceptMastery, LearningPathNode } from '../../types/video';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { VideoService } from './video';

// Notes
export async function saveNote(
  userId: string, 
  videoId: string, 
  content: string, 
  keyTakeaways: string[],
  reflections: {
    understanding: string[];
    gaps: string[];
    applications: string[];
    connections: string[];
  }
) {
  try {
    const notesRef = collection(db, 'users', userId, 'notes');
    const noteData = {
      userId,
      videoId,
      content,
      keyTakeaways,
      reflections,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Check if note already exists
    const existingNoteQuery = query(notesRef, where('videoId', '==', videoId));
    const existingNotes = await getDocs(existingNoteQuery);
    
    if (!existingNotes.empty) {
      // Update existing note
      const noteId = existingNotes.docs[0].id;
      await setDoc(doc(notesRef, noteId), {
        ...noteData,
        createdAt: existingNotes.docs[0].data().createdAt,
      });
      return noteId;
    } else {
      // Create new note
      const newNote = await addDoc(notesRef, noteData);
      return newNote.id;
    }
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
}

export async function getNoteForVideo(userId: string, videoId: string): Promise<Note | null> {
  try {
    const notesRef = collection(db, 'users', userId, 'notes');
    const noteQuery = query(notesRef, where('videoId', '==', videoId));
    const notes = await getDocs(noteQuery);
    
    if (notes.empty) return null;
    
    const noteData = notes.docs[0].data();
    return {
      id: notes.docs[0].id,
      ...noteData,
      createdAt: (noteData.createdAt as Timestamp).toDate(),
      updatedAt: (noteData.updatedAt as Timestamp).toDate(),
    } as Note;
  } catch (error) {
    console.error('Error getting note:', error);
    throw error;
  }
}

// Quiz Attempts
export async function saveQuizAttempt(
  userId: string, 
  quizId: string, 
  answers: number[], 
  score: number,
  videoId: string,
  subjectId: string
) {
  try {
    console.log('Saving quiz attempt:', { userId, quizId, score, videoId, subjectId });
    const attemptId = `${quizId}_${Date.now()}`;
    const attempt: QuizAttempt = {
      id: attemptId,
      userId,
      quizId,
      answers,
      score,
      completedAt: new Date()
    };

    // Save the quiz attempt with a unique ID
    await setDoc(
      doc(db, 'users', userId, 'quizAttempts', attemptId),
      attempt
    );
    console.log('Saved quiz attempt document');

    // Get or create user progress document
    const userProgressRef = doc(db, 'users', userId, 'progress', 'learning');
    const userProgressDoc = await getDoc(userProgressRef);
    console.log('Current user progress:', userProgressDoc.data());
    
    let userProgress: UserProgress;
    if (userProgressDoc.exists()) {
      userProgress = userProgressDoc.data() as UserProgress;
    } else {
      userProgress = {
        userId,
        subjects: {},
        streak: {
          currentStreak: 0,
          lastActivityDate: Timestamp.fromDate(new Date()),
          longestStreak: 0
        },
        totalStudyTime: 0,
        weeklyGoals: {
          target: 10,
          achieved: 0
        },
        activeLearningPaths: {},
        conceptMastery: {},
        learningPreferences: {
          preferredDuration: 10,  // Default to 10-minute videos
          preferredDifficulty: 'beginner',
          preferredLearningStyle: 'visual',
          topicsOfInterest: [],
          availableTimeSlots: []
        }
      };
      console.log('Created new user progress document');
    }

    // Update subject progress
    if (!userProgress.subjects[subjectId]) {
      userProgress.subjects[subjectId] = {
        progress: 0,
        lastActivity: Timestamp.fromDate(new Date()),
        completedVideos: [],
        masteredConcepts: [],
        quizScores: {},
        reflections: []
      };
      console.log('Initialized new subject progress');
    }

    // Update quiz scores and last activity
    userProgress.subjects[subjectId].quizScores[attemptId] = score;
    userProgress.subjects[subjectId].lastActivity = Timestamp.fromDate(new Date());
    console.log('Updated quiz scores:', userProgress.subjects[subjectId].quizScores);

    // Add video to completed videos if not already there
    if (!userProgress.subjects[subjectId].completedVideos.includes(videoId)) {
      userProgress.subjects[subjectId].completedVideos.push(videoId);
      console.log('Added video to completed videos');
    }

    // Calculate overall subject progress
    const subjectProgress = userProgress.subjects[subjectId];
    const totalQuizzes = Object.keys(subjectProgress.quizScores).length;
    const totalScore = Object.values(subjectProgress.quizScores).reduce((sum, score) => sum + score, 0);
    subjectProgress.progress = Math.round((totalScore / totalQuizzes) * 100) / 100;
    console.log('Calculated subject progress:', subjectProgress.progress);

    // Save updated progress
    await setDoc(userProgressRef, userProgress);
    console.log('Saved updated user progress');

    return attempt;
  } catch (error) {
    console.error('Error saving quiz attempt:', error);
    throw error;
  }
}

export async function getQuizAttempts(userId: string, quizId: string): Promise<QuizAttempt[]> {
  try {
    const attemptsRef = collection(db, 'users', userId, 'quizAttempts');
    const q = query(attemptsRef, where('quizId', '==', quizId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      completedAt: doc.data().completedAt.toDate(),
    })) as QuizAttempt[];
  } catch (error) {
    console.error('Error getting quiz attempts:', error);
    return [];
  }
}

export async function getLastQuizAttempt(userId: string, quizId: string): Promise<QuizAttempt | null> {
  try {
    const attempts = await getQuizAttempts(userId, quizId);
    if (attempts.length === 0) return null;
    
    // Sort by completedAt in descending order
    return attempts.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())[0];
  } catch (error) {
    console.error('Error getting last quiz attempt:', error);
    return null;
  }
}

// Get best quiz score
export async function getBestQuizScore(userId: string, quizId: string): Promise<number> {
  try {
    const attempts = await getQuizAttempts(userId, quizId);
    if (attempts.length === 0) return 0;
    
    return Math.max(...attempts.map(attempt => attempt.score));
  } catch (error) {
    console.error('Error getting best quiz score:', error);
    throw error;
  }
}

interface LearningProgress {
  userId: string;
  conceptId: string;
  mastery: number;
  lastReviewed: Date;
  nextReview: Date;
  retentionStreak: number;
  reviewHistory: {
    date: Date;
    performance: 'easy' | 'medium' | 'hard';
  }[];
}

// Spaced repetition intervals in hours
const REVIEW_INTERVALS = {
  initial: 24, // 1 day
  easy: [48, 96, 168, 336, 672], // 2, 4, 7, 14, 28 days
  medium: [24, 72, 168, 336], // 1, 3, 7, 14 days
  hard: [12, 24, 72, 168], // 12h, 1d, 3d, 7d
};

export async function getConceptProgress(userId: string): Promise<LearningProgress[]> {
  try {
    const progressRef = collection(db, 'learningProgress');
    const q = query(
      progressRef,
      where('userId', '==', userId),
      orderBy('nextReview', 'asc')
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      lastReviewed: doc.data().lastReviewed?.toDate() || new Date(),
      nextReview: doc.data().nextReview?.toDate() || new Date(),
      reviewHistory: (doc.data().reviewHistory || []).map((review: any) => ({
        ...review,
        date: review.date?.toDate() || new Date(),
      })),
    })) as LearningProgress[];
  } catch (error) {
    console.error('Error getting concept progress:', error);
    throw error;
  }
}

export async function getDueReviews(userId: string): Promise<RetentionPrompt[]> {
  try {
    const progressRef = collection(db, 'learningProgress');
    const now = new Date();
    const q = query(
      progressRef,
      where('userId', '==', userId),
      where('nextReview', '<=', now),
      orderBy('nextReview', 'asc')
    );
    
    const snapshot = await getDocs(q);
    const dueProgress = snapshot.docs.map(doc => doc.data());
    
    // If no concepts are due, return empty array
    if (dueProgress.length === 0) {
      return [];
    }
    
    // Get retention prompts for due concepts
    const conceptIds = dueProgress.map(p => p.conceptId);
    const promptsRef = collection(db, 'retentionPrompts');
    const promptsQuery = query(
      promptsRef,
      where('conceptId', 'in', conceptIds)
    );
    
    const promptsSnapshot = await getDocs(promptsQuery);
    return promptsSnapshot.docs.map(doc => doc.data() as RetentionPrompt);
  } catch (error) {
    console.error('Error getting due reviews:', error);
    throw error;
  }
}

export async function updateReviewProgress(
  userId: string,
  conceptId: string,
  performance: 'easy' | 'medium' | 'hard'
): Promise<void> {
  try {
    const progressRef = doc(db, 'learningProgress', `${userId}_${conceptId}`);
    const progressDoc = await getDoc(progressRef);
    const progress = progressDoc.data() as LearningProgress;
    
    // Calculate next review interval
    const intervals = REVIEW_INTERVALS[performance];
    const currentStreak = progress.retentionStreak || 0;
    const intervalIndex = Math.min(currentStreak, intervals.length - 1);
    const nextInterval = intervals[intervalIndex];
    
    // Update mastery based on performance
    const masteryDelta = performance === 'easy' ? 10 : performance === 'medium' ? 5 : -5;
    const newMastery = Math.max(0, Math.min(100, progress.mastery + masteryDelta));
    
    // Calculate next review date
    const now = new Date();
    const nextReview = new Date(now.getTime() + nextInterval * 60 * 60 * 1000);
    
    // Update progress
    await updateDoc(progressRef, {
      mastery: newMastery,
      lastReviewed: Timestamp.fromDate(now),
      nextReview: Timestamp.fromDate(nextReview),
      retentionStreak: performance === 'hard' ? 0 : currentStreak + 1,
      reviewHistory: [
        ...progress.reviewHistory,
        {
          date: Timestamp.fromDate(now),
          performance,
        },
      ],
    });
  } catch (error) {
    console.error('Error updating review progress:', error);
    throw error;
  }
}

export async function initializeConceptProgress(
  userId: string,
  concept: LearningConcept
): Promise<void> {
  try {
    const progressRef = doc(db, 'learningProgress', `${userId}_${concept.id}`);
    const now = new Date();
    const initialReview = new Date(now.getTime() + REVIEW_INTERVALS.initial * 60 * 60 * 1000);
    
    await setDoc(progressRef, {
      userId,
      conceptId: concept.id,
      mastery: 0,
      lastReviewed: Timestamp.fromDate(now),
      nextReview: Timestamp.fromDate(initialReview),
      retentionStreak: 0,
      reviewHistory: [],
    });
  } catch (error) {
    console.error('Error initializing concept progress:', error);
    throw error;
  }
}

export async function initializeSampleData(userId: string): Promise<void> {
  try {
    // Sample concepts
    const concepts: LearningConcept[] = [
      {
        id: 'ml-basics',
        name: 'Machine Learning Basics',
        description: 'Fundamental concepts of machine learning',
        prerequisites: [],
        retentionPrompts: [
          {
            id: 'ml-basics-1',
            conceptId: 'ml-basics',
            prompt: 'Explain the difference between supervised and unsupervised learning',
            difficulty: 'medium'
          },
          {
            id: 'ml-basics-2',
            conceptId: 'ml-basics',
            prompt: 'What are the main steps in a machine learning pipeline?',
            difficulty: 'hard'
          }
        ],
        transferTasks: []
      },
      {
        id: 'neural-networks',
        name: 'Neural Networks',
        description: 'Understanding neural networks and deep learning',
        prerequisites: ['ml-basics'],
        retentionPrompts: [
          {
            id: 'nn-1',
            conceptId: 'neural-networks',
            prompt: 'Explain how backpropagation works in neural networks',
            difficulty: 'hard'
          },
          {
            id: 'nn-2',
            conceptId: 'neural-networks',
            prompt: 'What is the purpose of activation functions?',
            difficulty: 'medium'
          }
        ],
        transferTasks: []
      }
    ];

    // Save concepts
    const conceptsRef = collection(db, 'concepts');
    for (const concept of concepts) {
      await setDoc(doc(conceptsRef, concept.id), concept);
    }

    // Save retention prompts
    const promptsRef = collection(db, 'retentionPrompts');
    for (const concept of concepts) {
      for (const prompt of concept.retentionPrompts) {
        await setDoc(doc(promptsRef, prompt.id), prompt);
      }
    }

    // Initialize progress for each concept
    for (const concept of concepts) {
      await initializeConceptProgress(userId, concept);
    }

    console.log('Sample data initialized successfully');
  } catch (error) {
    console.error('Error initializing sample data:', error);
    throw error;
  }
}

export async function getConcept(conceptId: string): Promise<LearningConcept | null> {
  try {
    const conceptRef = doc(db, 'concepts', conceptId);
    const conceptDoc = await getDoc(conceptRef);
    
    if (!conceptDoc.exists()) {
      return null;
    }

    return conceptDoc.data() as LearningConcept;
  } catch (error) {
    console.error('Error getting concept:', error);
    throw error;
  }
}

interface LearningStyleAnalysis {
  preferredContentTypes: string[];
  optimalDuration: number;
  challengeLevel: number;
  conceptConnections: string[];
  learningPace: 'fast' | 'medium' | 'slow';
}

interface KnowledgeGapAnalysis {
  weakConcepts: string[];
  misunderstoodRelationships: string[];
  recommendedPractice: string[];
  confidenceScores: { [conceptId: string]: number };
}

export class LearningService {
  static async getUserProgress(userId: string): Promise<UserProgress | null> {
    try {
      const progressRef = doc(db, 'users', userId, 'progress', 'learning');
      const progressDoc = await getDoc(progressRef);
      
      if (!progressDoc.exists()) {
        // Initialize default progress for new users
        const defaultProgress: UserProgress = {
          userId,
          subjects: {},
          streak: {
            currentStreak: 0,
            lastActivityDate: Timestamp.now(),
            longestStreak: 0
          },
          totalStudyTime: 0,
          weeklyGoals: {
            target: 10,
            achieved: 0
          },
          conceptMastery: {},
          learningPreferences: {
            preferredDuration: 10,
            preferredDifficulty: 'beginner',
            preferredLearningStyle: 'visual',
            topicsOfInterest: [],
            availableTimeSlots: []
          },
          activeLearningPaths: {}
        };
        
        await setDoc(progressRef, defaultProgress);
        return defaultProgress;
      }

      return progressDoc.data() as UserProgress;
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }

  static async updateLearningPreferences(
    userId: string,
    preferences: LearningPreferences
  ): Promise<void> {
    try {
      const progressRef = doc(db, 'users', userId, 'progress', 'learning');
      await updateDoc(progressRef, {
        learningPreferences: preferences
      });
    } catch (error) {
      console.error('Error updating learning preferences:', error);
      throw error;
    }
  }

  static async generateLearningPath(
    userId: string,
    subjectId: string
  ): Promise<LearningPath> {
    try {
      // Create a basic learning path if none exists
      const defaultPath: LearningPath = {
        userId,
        subjectId,
        nodes: [],
        currentNodeIndex: 0,
        lastUpdated: new Date(),
        completionRate: 0,
        averageScore: 0
      };

      // Get videos for this subject
      const videos = await VideoService.getVideosBySubject(subjectId);
      
      // Create nodes from videos
      defaultPath.nodes = videos.map(video => ({
        videoId: video.id,
        type: 'core',
        requiredConcepts: video.conceptIds || [],
        estimatedDuration: video.duration,
        difficulty: 50, // Default medium difficulty
        completed: false
      }));

      // Save the path
      const progress = await this.getUserProgress(userId);
      if (progress) {
        const progressRef = doc(db, 'users', userId, 'progress', 'learning');
        await updateDoc(progressRef, {
          [`activeLearningPaths.${subjectId}`]: defaultPath
        });
      }

      return defaultPath;
    } catch (error) {
      console.error('Error generating learning path:', error);
      throw error;
    }
  }

  static async updateConceptMastery(
    userId: string,
    conceptId: string,
    update: Partial<ConceptMastery>
  ): Promise<void> {
    try {
      const progressRef = doc(db, 'users', userId, 'progress', 'learning');
      await updateDoc(progressRef, {
        [`conceptMastery.${conceptId}`]: update
      });
    } catch (error) {
      console.error('Error updating concept mastery:', error);
      throw error;
    }
  }

  static async completePathNode(
    userId: string,
    subjectId: string,
    nodeIndex: number,
    score?: number
  ): Promise<void> {
    try {
      const progressRef = doc(db, 'users', userId, 'progress', 'learning');
      const progressDoc = await getDoc(progressRef);
      
      if (!progressDoc.exists()) {
        throw new Error('User progress not found');
      }

      const progress = progressDoc.data() as UserProgress;
      const path = progress.activeLearningPaths[subjectId];
      
      if (!path) {
        throw new Error('Learning path not found');
      }

      // Update node completion status
      path.nodes[nodeIndex].completed = true;
      if (score !== undefined) {
        path.nodes[nodeIndex].score = score;
      }

      // Update path metrics
      path.currentNodeIndex = nodeIndex + 1;
      path.completionRate = path.nodes.filter(node => node.completed).length / path.nodes.length;
      path.averageScore = path.nodes
        .filter(node => node.score !== undefined)
        .reduce((sum, node) => sum + (node.score || 0), 0) / 
        path.nodes.filter(node => node.score !== undefined).length;
      path.lastUpdated = new Date();

      // Save updates
      await updateDoc(progressRef, {
        [`activeLearningPaths.${subjectId}`]: path
      });

      // If this was a review node, schedule next review
      const completedNode = path.nodes[nodeIndex];
      if (completedNode.type === 'review' && score !== undefined) {
        const nextReview = this.calculateNextReviewDate(score);
        await this.updateConceptMastery(userId, completedNode.requiredConcepts[0], {
          lastReviewed: new Date(),
          nextReviewDate: nextReview,
          level: this.calculateNewMasteryLevel(score)
        });
      }
    } catch (error) {
      console.error('Error completing path node:', error);
      throw error;
    }
  }

  private static calculateNextReviewDate(score: number): Date {
    // Implement spaced repetition algorithm
    const now = new Date();
    const baseInterval = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    
    // Adjust interval based on score
    let multiplier = 1;
    if (score >= 90) multiplier = 4;      // Review in 4 days
    else if (score >= 70) multiplier = 2;  // Review in 2 days
    else multiplier = 1;                   // Review tomorrow
    
    return new Date(now.getTime() + (baseInterval * multiplier));
  }

  private static calculateNewMasteryLevel(score: number): number {
    // Simple mastery level calculation
    // Score of 90+ increases level by 20
    // Score of 70-89 increases level by 10
    // Score below 70 decreases level by 10
    // Clamp final value between 0-100
    return Math.max(0, Math.min(100, score >= 90 ? 20 : score >= 70 ? 10 : -10));
  }

  static async getRecommendedVideos(userId: string): Promise<LearningPathNode[]> {
    try {
      const progress = await this.getUserProgress(userId);
      if (!progress) {
        return [];
      }

      // Return empty array if no recommendations yet
      // Later we can implement the recommendation logic
      return [];
    } catch (error) {
      console.error('Error getting video recommendations:', error);
      return []; // Return empty array instead of throwing
    }
  }

  static async getDueReviews(userId: string): Promise<LearningPathNode[]> {
    try {
      const progress = await this.getUserProgress(userId);
      if (!progress) {
        return [];
      }

      // Return empty array if no reviews due
      // Later we can implement the review scheduling logic
      return [];
    } catch (error) {
      console.error('Error getting due reviews:', error);
      return []; // Return empty array instead of throwing
    }
  }

  static async analyzeLearningStyle(userId: string): Promise<LearningStyleAnalysis> {
    try {
      const functions = getFunctions();
      const analyzeStyle = httpsCallable<
        { userId: string },
        { analysis: LearningStyleAnalysis }
      >(functions, 'analyzeLearningStyle');

      const result = await analyzeStyle({ userId });
      return result.data.analysis;
    } catch (error) {
      console.error('Error analyzing learning style:', error);
      throw error;
    }
  }

  static async generatePersonalizedPath(
    userId: string,
    subjectId: string,
    learningStyle: LearningStyleAnalysis
  ): Promise<LearningPath> {
    try {
      const functions = getFunctions();
      const generatePath = httpsCallable<
        { 
          userId: string;
          subjectId: string;
          learningStyle: LearningStyleAnalysis;
        },
        { path: LearningPath }
      >(functions, 'generatePersonalizedPath');

      const result = await generatePath({
        userId,
        subjectId,
        learningStyle
      });

      return result.data.path;
    } catch (error) {
      console.error('Error generating personalized path:', error);
      throw error;
    }
  }

  static async analyzeKnowledgeGaps(
    userId: string,
    subjectId: string
  ): Promise<KnowledgeGapAnalysis> {
    try {
      const functions = getFunctions();
      const analyzeGaps = httpsCallable<
        { userId: string; subjectId: string },
        { analysis: KnowledgeGapAnalysis }
      >(functions, 'analyzeKnowledgeGaps');

      const result = await analyzeGaps({ userId, subjectId });
      return result.data.analysis;
    } catch (error) {
      console.error('Error analyzing knowledge gaps:', error);
      throw error;
    }
  }

  static async predictOptimalReviewTime(
    userId: string,
    conceptId: string,
    performance: number
  ): Promise<Date> {
    try {
      const functions = getFunctions();
      const predictReview = httpsCallable<
        { 
          userId: string;
          conceptId: string;
          performance: number;
          learningHistory?: {
            timestamp: Date;
            score: number;
          }[];
        },
        { nextReview: string }
      >(functions, 'predictOptimalReviewTime');

      // Get learning history for better prediction
      const progress = await this.getUserProgress(userId);
      const conceptMastery = progress?.conceptMastery[conceptId];
      const learningHistory = conceptMastery?.reviewHistory || [];

      const result = await predictReview({
        userId,
        conceptId,
        performance,
        learningHistory
      });

      return new Date(result.data.nextReview);
    } catch (error) {
      console.error('Error predicting review time:', error);
      throw error;
    }
  }

  static async updateLearningPath(
    userId: string,
    subjectId: string,
    performance: {
      conceptId: string;
      score: number;
      timeSpent: number;
      errorPatterns?: string[];
    }[]
  ): Promise<LearningPath> {
    try {
      const functions = getFunctions();
      const updatePath = httpsCallable<
        {
          userId: string;
          subjectId: string;
          performance: typeof performance;
        },
        { updatedPath: LearningPath }
      >(functions, 'updateLearningPath');

      // First analyze current learning style and gaps
      const [learningStyle, knowledgeGaps] = await Promise.all([
        this.analyzeLearningStyle(userId),
        this.analyzeKnowledgeGaps(userId, subjectId)
      ]);

      // Update path with all available data
      const result = await updatePath({
        userId,
        subjectId,
        performance: performance.map(p => ({
          ...p,
          // Add AI-analyzed context to each performance record
          conceptStrength: knowledgeGaps.confidenceScores[p.conceptId],
          recommendedFocus: knowledgeGaps.weakConcepts.includes(p.conceptId),
          adaptedDifficulty: this.calculateAdaptiveDifficulty(
            p.score,
            learningStyle.challengeLevel,
            p.timeSpent
          )
        }))
      });

      return result.data.updatedPath;
    } catch (error) {
      console.error('Error updating learning path:', error);
      throw error;
    }
  }

  private static calculateAdaptiveDifficulty(
    score: number,
    baseChallenge: number,
    timeSpent: number
  ): number {
    // Implement adaptive difficulty calculation
    const performanceFactor = score / 100;
    const timeFactor = Math.min(timeSpent / 300, 1); // Normalize to 5 minutes
    const challengeWeight = baseChallenge / 100;

    // Calculate difficulty (0-100) based on multiple factors
    return Math.round(
      100 * (
        0.4 * (1 - performanceFactor) + // Lower score = higher difficulty
        0.3 * timeFactor + // More time spent = higher difficulty
        0.3 * challengeWeight // Base challenge preference
      )
    );
  }
} 