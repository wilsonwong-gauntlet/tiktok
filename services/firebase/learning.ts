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
  updateDoc
} from 'firebase/firestore';
import { db, auth } from './index';
import { Note, Quiz, QuizAttempt, LearningConcept, RetentionPrompt } from '../../types/video';

interface UserProgress {
  userId: string;
  subjects: {
    [subjectId: string]: {
      progress: number;
      lastActivity: Timestamp;
      completedVideos: string[];
      masteredConcepts: string[];
      quizScores: {
        [quizId: string]: number;
      };
      reflections: string[];
    };
  };
  streak: {
    currentStreak: number;
    lastActivityDate: Timestamp;
    longestStreak: number;
  };
  totalStudyTime: number;
  weeklyGoals: {
    target: number;
    achieved: number;
  };
}

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