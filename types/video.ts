export interface Note {
  id: string;
  userId: string;
  videoId: string;
  content: string;
  keyTakeaways: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  videoId: string;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  answers: number[];
  score: number;
  completedAt: Date;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  createdAt: Date;
  category: string;
  tags: string[];
  aiSummary?: string;
  furtherReading?: FurtherReading[];
  quiz?: Quiz;
  viewCount: number;
  authorId: string;
  authorName: string;
  concepts: LearningConcept[];
  retentionSchedule?: {
    initialReview: number;  // hours after watching
    reviewIntervals: number[];  // hours between reviews
  };
}

export interface FurtherReading {
  title: string;
  url: string;
  description?: string;
}

export interface VideoFeed {
  videos: Video[];
  lastVisible?: any; // TODO: Type this properly with Firestore types
  loading: boolean;
  error?: string;
}

export interface VideoMetadata {
  title: string;
  author: string;
  description: string;
}

export interface VideoPlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  progress: number;
}

export interface UserPreferences {
  interests: string[];
  viewedVideos: string[];
  savedVideos: string[];
  learningProgress: {
    [categoryId: string]: {
      level: number;
      completedVideos: number;
    };
  };
}

export interface RetentionPrompt {
  id: string;
  conceptId: string;
  prompt: string;
  lastReviewed?: Date;
  nextReview?: Date;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TransferTask {
  id: string;
  conceptId: string;
  task: string;
  context: string;  // New context to apply the concept
  difficulty: 'basic' | 'intermediate' | 'advanced';
  completionCriteria: string[];
}

export interface LearningConcept {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
  retentionPrompts: RetentionPrompt[];
  transferTasks: TransferTask[];
} 