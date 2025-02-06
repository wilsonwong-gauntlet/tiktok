export interface Note {
  id: string;
  userId: string;
  videoId: string;
  content: string;  // Quick capture
  keyTakeaways: string[];
  reflections: {
    understanding: string[];
    gaps: string[];
    applications: string[];
    connections: string[];
  };
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

export interface VideoSummary {
  key_points: string[];
  main_concepts: string[];
  generated_at: Date;
  transcription?: string;  // Add transcription to summary
}

export interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  createdAt: Date;
  
  // Subject & Concept Relationships
  subjectId: string;
  conceptIds: string[];
  relatedSubjects?: string[];
  
  // Learning Materials
  summary?: VideoSummary;
  furtherReading?: FurtherReading[];
  quiz?: Quiz;
  
  // Metadata
  tags: string[];
  searchableText: string[];
  viewCount: number;
  authorId: string;
  authorName: string;
  
  // Processing Status
  transcription?: string;
  transcriptionStatus: 'pending' | 'completed' | 'error';
  transcriptionError?: string;
  transcriptionUpdatedAt?: Date;
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

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  likes: number;
  replies?: Comment[];
}

export interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: 'concept' | 'prerequisite';
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'mastered';
  prerequisites: string[];
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  progress: number;
  concepts: Concept[];
  prerequisites: string[];
  videosCount: number;
  completedVideos: number;
  knowledgeGraph: GraphData;
}

export interface Reflection {
  id: string;
  content: string;
  timestamp: Date;
  conceptId: string;
}

export interface UserProgress {
  userId: string;
  subjects: {
    [subjectId: string]: {
      progress: number;
      lastActivity: Date;
      completedVideos: string[];
      masteredConcepts: string[];
      quizScores: {
        [quizId: string]: number;
      };
      reflections: Reflection[];
    }
  };
  learningStreak: number;
  totalStudyTime: number;
  weeklyGoals: {
    target: number;
    achieved: number;
  };
} 