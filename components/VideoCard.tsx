import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Video as VideoType } from '../types/video';
import { auth, saveVideo, unsaveVideo, isVideoSaved } from '../services/firebase/index';
import { useEvent } from 'expo';
import LearningPanel from './LearningPanel';
import CommentSection from './CommentSection';
import { useVideoSave } from '../contexts/VideoSaveContext';

interface VideoCardProps {
  video: VideoType;
  isActive: boolean;
  containerHeight?: number;
}

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 49; // Standard tab bar height
const SCREEN_HEIGHT = WINDOW_HEIGHT - TAB_BAR_HEIGHT;

export default function VideoCard({ video, isActive, containerHeight }: VideoCardProps) {
  const [saved, setSaved] = useState(false);
  const [learningPanelVisible, setLearningPanelVisible] = useState(false);
  const [commentSectionVisible, setCommentSectionVisible] = useState(false);
  const { notifyVideoSaveChanged } = useVideoSave();
  
  const player = useVideoPlayer(video.url, player => {
    console.log('Video source:', video.url);
    player.loop = true;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (isActive && status === 'readyToPlay' && !isPlaying) {
      player.play();
    } else if (!isActive && isPlaying) {
      player.pause();
    }
  }, [isActive, status, isPlaying]);

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
      notifyVideoSaveChanged(video.id);
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

  
  const handleLearn = () => {
    setLearningPanelVisible(true);
  };

  const handleCommentsPress = () => {
    setCommentSectionVisible(true);
  };

  return (
    <View style={[styles.container, containerHeight ? { height: containerHeight } : null]}>
      <TouchableOpacity 
        style={styles.videoContainer} 
        onPress={handlePlayPause}
        activeOpacity={0.9}
      >
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          allowsFullscreen={false}
          showsTimecodes={false}
          nativeControls={false}
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
        
        <View style={styles.overlay}>
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
              <Ionicons 
                name={saved ? "bookmark" : "bookmark-outline"} 
                size={32} 
                color="#fff" 
              />
              <Text style={styles.actionText}>Save</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleCommentsPress}>
              <Ionicons 
                name="chatbubble-outline" 
                size={32} 
                color="#fff" 
              />
              <Text style={styles.actionText}>Comments</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleLearn}>
              <Ionicons 
                name="school-outline" 
                size={32} 
                color="#fff" 
              />
              <Text style={styles.actionText}>Learn</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomMetadata}>
            <Text style={styles.title} numberOfLines={1}>{video.title}</Text>
            <Text style={styles.author} numberOfLines={1}>{video.authorName}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {video.description}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <LearningPanel
        visible={learningPanelVisible}
        onClose={() => setLearningPanelVisible(false)}
        title={video.title}
        videoId={video.id}
        aiSummary={video.aiSummary}
        furtherReading={video.furtherReading}
        quiz={video.quiz}
        transcription={video.transcription}
        transcriptionStatus={video.transcriptionStatus}
      />

      <CommentSection
        visible={commentSectionVisible}
        onClose={() => setCommentSectionVisible(false)}
        videoId={video.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: WINDOW_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  rightActions: {
    position: 'absolute',
    right: 8,
    bottom: 60, // Adjusted to account for tab bar
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 45,
    marginBottom: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomMetadata: {
    flex: 1,
    paddingHorizontal: 16,
    paddingRight: 80,
    marginBottom: 16, // Adjusted to account for tab bar
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  author: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    color: '#fff',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
  },
}); 