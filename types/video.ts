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
  furtherReading?: {
    title: string;
    url: string;
    description?: string;
  }[];
  viewCount: number;
  authorId: string;
  authorName: string;
}

export interface VideoFeed {
  videos: Video[];
  lastVisible?: any; // For pagination
  loading: boolean;
  error?: string;
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