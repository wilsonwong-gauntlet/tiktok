import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase/index';
import { collection, getDocs, DocumentData } from 'firebase/firestore';

type VideoSaveCallback = (videoId: string) => void;

interface VideoSaveContextType {
  notifyVideoSaveChanged: (videoId: string) => void;
  subscribe: (callback: VideoSaveCallback) => () => void;
  savedVideoIds: string[];
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
  const [savedVideoIds, setSavedVideoIds] = useState<string[]>([]);

  // Load initial saved state
  useEffect(() => {
    const loadSavedState = async () => {
      if (!auth.currentUser) return;
      
      try {
        const savedRef = collection(db, 'users', auth.currentUser.uid, 'savedVideos');
        const snapshot = await getDocs(savedRef);
        const ids = snapshot.docs.map((doc: DocumentData) => doc.id);
        setSavedVideoIds(ids);
      } catch (error) {
        console.error('Error loading saved video ids:', error);
      }
    };

    loadSavedState();
  }, []);

  const subscribe = useCallback((callback: VideoSaveCallback) => {
    subscribers.current.add(callback);
    return () => {
      subscribers.current.delete(callback);
    };
  }, []);

  const notifyVideoSaveChanged = useCallback((videoId: string) => {
    setSavedVideoIds(prev => {
      const isCurrentlySaved = prev.includes(videoId);
      if (isCurrentlySaved) {
        return prev.filter(id => id !== videoId);
      } else {
        return [...prev, videoId];
      }
    });
    subscribers.current.forEach(callback => callback(videoId));
  }, []);

  return (
    <VideoSaveContext.Provider value={{ notifyVideoSaveChanged, subscribe, savedVideoIds }}>
      {children}
    </VideoSaveContext.Provider>
  );
} 