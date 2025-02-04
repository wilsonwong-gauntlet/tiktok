import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Video as VideoType } from '../types/video';
import { auth, saveVideo, unsaveVideo, isVideoSaved } from '../services/firebase/index';
import { useEvent } from 'expo';
import VideoInfoModal from './VideoInfoModal';

interface VideoCardProps {
  video: VideoType;
  isActive: boolean;
}

const { width, height } = Dimensions.get('window');

export default function VideoCard({ video, isActive }: VideoCardProps) {
  const [saved, setSaved] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'summary' | 'reading'>('summary');
  
  const player = useVideoPlayer(video.url, player => {
    console.log('Video source:', video.url);
    player.loop = true;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (isActive && status === 'readyToPlay' && !isPlaying) {
      player.play();
    }
  }, [isActive, status]);

  useEffect(() => {
    const checkSavedStatus = async () => {
      if (auth.currentUser) {
        const isSaved = await isVideoSaved(auth.currentUser.uid, video.id);
        setSaved(isSaved);
      }
    };
    checkSavedStatus();
  }, [video.id]);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    try {
      if (saved) {
        await unsaveVideo(auth.currentUser.uid, video.id);
        setSaved(false);
      } else {
        await saveVideo(auth.currentUser.uid, video.id);
        setSaved(true);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleShowSummary = () => {
    setModalType('summary');
    setModalVisible(true);
  };

  const handleShowReading = () => {
    setModalType('reading');
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.videoContainer} 
        onPress={handlePlayPause}
        activeOpacity={0.9}
      >
        <VideoView
          style={styles.video}
          player={player}
        />
        
        {status === 'loading' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {status === 'error' && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error loading video</Text>
          </View>
        )}

        {!isPlaying && status === 'readyToPlay' && (
          <View style={styles.playButtonContainer}>
            <TouchableOpacity 
              style={styles.playButton} 
              onPress={handlePlayPause}
              activeOpacity={0.7}
            >
              <Text style={styles.playButtonText}>▶️</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.overlay}>
          {/* Right side actions */}
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
              <Ionicons 
                name={saved ? "bookmark" : "bookmark-outline"} 
                size={32} 
                color="#fff" 
              />
              <Text style={styles.actionText}>Save</Text>
            </TouchableOpacity>
            
            {video.aiSummary && (
              <TouchableOpacity style={styles.actionButton} onPress={handleShowSummary}>
                <Ionicons 
                  name="document-text-outline" 
                  size={32} 
                  color="#fff" 
                />
                <Text style={styles.actionText}>AI Summary</Text>
              </TouchableOpacity>
            )}
            
            {video.furtherReading && video.furtherReading.length > 0 && (
              <TouchableOpacity style={styles.actionButton} onPress={handleShowReading}>
                <Ionicons 
                  name="book-outline" 
                  size={32} 
                  color="#fff" 
                />
                <Text style={styles.actionText}>Reading</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom metadata */}
          <View style={styles.bottomMetadata}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.author}>{video.authorName}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {video.description}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <VideoInfoModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={video.title}
        aiSummary={video.aiSummary}
        furtherReading={video.furtherReading}
        type={modalType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height: height,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
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
    flexDirection: 'row',
    zIndex: 4,
  },
  rightActions: {
    position: 'absolute',
    right: 8,
    bottom: 100,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomMetadata: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingRight: 80, // Make space for right actions
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  author: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  description: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
  },
}); 