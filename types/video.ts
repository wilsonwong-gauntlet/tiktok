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
  viewCount: number;
  authorId: string;
  authorName: string;
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