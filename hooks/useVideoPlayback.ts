import { useRef, useState, useCallback } from 'react';
import { Video, AVPlaybackStatus } from 'expo-av';
import { VideoPlaybackState } from '../types/video';

export function useVideoPlayback() {
  const videoRef = useRef<Video>(null);
  const [playbackState, setPlaybackState] = useState<VideoPlaybackState>({
    isPlaying: false,
    isLoading: true,
    error: null,
    progress: 0,
  });

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    console.log('Playback status update:', status);
    if (status.isLoaded) {
      setPlaybackState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
        isPlaying: status.isPlaying,
        progress: status.durationMillis ? status.positionMillis / status.durationMillis : 0,
      }));
    } else {
      setPlaybackState(prev => ({
        ...prev,
        isLoading: false,
        error: status.error?.toString() || null,
      }));
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    console.log('Toggle play/pause called, videoRef:', videoRef.current ? 'exists' : 'null');
    if (!videoRef.current) return;
    
    try {
      if (playbackState.isPlaying) {
        console.log('Attempting to pause video');
        await videoRef.current.pauseAsync();
      } else {
        console.log('Attempting to play video');
        await videoRef.current.playAsync();
      }
    } catch (err) {
      console.error('Error toggling play/pause:', err);
      const error = err instanceof Error ? err.message : 'Failed to toggle playback';
      setPlaybackState(prev => ({
        ...prev,
        error,
      }));
    }
  }, [playbackState.isPlaying]);

  const onLoad = useCallback(() => {
    console.log('Video loaded');
    setPlaybackState(prev => ({
      ...prev,
      isLoading: false,
    }));
  }, []);

  const onError = useCallback((error: string | Error) => {
    console.error('Video error:', error);
    setPlaybackState(prev => ({
      ...prev,
      isLoading: false,
      error: typeof error === 'string' ? error : error.message || 'Failed to load video',
    }));
  }, []);

  return {
    videoRef,
    playbackState,
    onPlaybackStatusUpdate,
    togglePlayPause,
    onLoad,
    onError,
  };
} 