import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ResizeMode, Video, AVPlaybackStatus } from 'expo-av';
import { Video as VideoType } from '../types/video';

interface VideoCardProps {
  video: VideoType;
}

const { width, height } = Dimensions.get('window');

export default function VideoCard({ video }: VideoCardProps) {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    console.log('Playback status update:', status);
    if (status.isLoaded) {
      setIsLoading(false);
      setError(null);
      setIsPlaying(status.isPlaying);
    } else {
      setIsLoading(false);
      if (status.error) {
        console.error('Video loading error:', status.error);
        setError(status.error);
      }
    }
  };

  const togglePlayPause = async () => {
    console.log('Toggle play/pause called, videoRef:', videoRef.current ? 'exists' : 'null');
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        console.log('Attempting to pause video');
        await videoRef.current.pauseAsync();
      } else {
        console.log('Attempting to play video');
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  console.log('Rendering video with URL:', video.url);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.videoContainer} 
        onPress={togglePlayPause}
        activeOpacity={0.9}
      >
        <Video
          ref={videoRef}
          source={{ uri: video.url }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          useNativeControls
          isMuted={false}
          volume={1.0}
          rate={1.0}
          shouldPlay={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onLoad={() => {
            console.log('Video loaded');
            setIsLoading(false);
          }}
          onError={(error) => {
            console.error('Video error:', error);
            setError(typeof error === 'string' ? error : 'Failed to load video');
            setIsLoading(false);
          }}
          posterSource={{ uri: video.thumbnailUrl }}
          usePoster={true}
          posterStyle={styles.poster}
        />
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error loading video: {error}</Text>
          </View>
        )}

        {!isPlaying && !isLoading && !error && (
          <View style={styles.playButtonContainer}>
            <TouchableOpacity 
              style={styles.playButton} 
              onPress={togglePlayPause}
              activeOpacity={0.7}
            >
              <Text style={styles.playButtonText}>▶️</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.overlay, isPlaying ? styles.overlayHidden : null]}>
          <View style={styles.metadata}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.author}>{video.authorName}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {video.description}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>AI Summary</Text>
            </TouchableOpacity>
            
            {video.furtherReading && video.furtherReading.length > 0 && (
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionText}>Further Reading</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    zIndex: 1,
  },
  poster: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 2,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    zIndex: 2,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 40,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 4,
  },
  overlayHidden: {
    opacity: 0,
  },
  metadata: {
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  author: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  description: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  actions: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 