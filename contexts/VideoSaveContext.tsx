import React, { createContext, useContext, useCallback } from 'react';

interface VideoSaveContextType {
  notifyVideoSaveChanged: (videoId: string) => void;
}

const VideoSaveContext = createContext<VideoSaveContextType | null>(null);

export function useVideoSave() {
  const context = useContext(VideoSaveContext);
  if (!context) {
    throw new Error('useVideoSave must be used within a VideoSaveProvider');
  }
  return context;
}

export function VideoSaveProvider({ children }: { children: React.ReactNode }) {
  const notifyVideoSaveChanged = useCallback((videoId: string) => {
    // This will be used to trigger a refresh of components that care about saved state
    // The implementation is simple - components will listen to this context
    // and refresh their state when notified
  }, []);

  return (
    <VideoSaveContext.Provider value={{ notifyVideoSaveChanged }}>
      {children}
    </VideoSaveContext.Provider>
  );
} 