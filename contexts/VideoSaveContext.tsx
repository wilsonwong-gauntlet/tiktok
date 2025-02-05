import React, { createContext, useContext, useCallback, useRef } from 'react';

type VideoSaveCallback = (videoId: string) => void;

interface VideoSaveContextType {
  notifyVideoSaveChanged: (videoId: string) => void;
  subscribe: (callback: VideoSaveCallback) => () => void;
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
  const subscribers = useRef<Set<VideoSaveCallback>>(new Set());

  const subscribe = useCallback((callback: VideoSaveCallback) => {
    subscribers.current.add(callback);
    return () => {
      subscribers.current.delete(callback);
    };
  }, []);

  const notifyVideoSaveChanged = useCallback((videoId: string) => {
    subscribers.current.forEach(callback => callback(videoId));
  }, []);

  return (
    <VideoSaveContext.Provider value={{ notifyVideoSaveChanged, subscribe }}>
      {children}
    </VideoSaveContext.Provider>
  );
} 