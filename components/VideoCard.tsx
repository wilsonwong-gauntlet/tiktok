import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Video as VideoType, Subject, Quiz } from '../types/video';
import { auth, saveVideo, unsaveVideo, isVideoSaved } from '../services/firebase/index';
import { useEvent } from 'expo';
import LearningPanel from './LearningPanel';
import CommentSection from './CommentSection';
import { useVideoSave } from '../contexts/VideoSaveContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { SubjectService } from '../services/firebase/subjects';

interface VideoCardProps {
  video: VideoType;
  isActive: boolean;
  containerHeight?: number;
  isModal?: boolean;
}

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 49; // Standard tab bar height
const SCREEN_HEIGHT = WINDOW_HEIGHT - TAB_BAR_HEIGHT;

export default function VideoCard({ video, isActive, containerHeight, isModal = false }: VideoCardProps) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);
  const [learningPanelVisible, setLearningPanelVisible] = useState(false);
  const [commentSectionVisible, setCommentSectionVisible] = useState(false);
  const { notifyVideoSaveChanged } = useVideoSave();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const pathname = usePathname();
  const [currentQuiz, setCurrentQuiz] = useState(video.quiz);

  // Reset manual pause when video becomes inactive
  useEffect(() => {
    if (!isActive) {
      setManuallyPaused(false);
    }
  }, [isActive]);

  // Comprehensive path checking for home tab
  const isInHomeTab = pathname === '/' || // Root path
                     pathname === '/index' || // Direct index
                     pathname === '/(app)' || // App group
                     pathname === '/(app)/(tabs)' || // Tabs group
                     pathname === '/(app)/(tabs)/index'; // Full path

  // Debug logging
  useEffect(() => {
    console.log('Video Playback Debug:', {
      videoId: video.id,
      pathname,
      isInHomeTab,
      isActive,
      isModal,
      shouldPlay: isModal || (isActive && isInHomeTab)
    });
  }, [pathname, isActive, isModal]);

  // Consider both automatic and manual controls
  const shouldPlay = (isModal || (isActive && isInHomeTab)) && !manuallyPaused;
  
  const player = useVideoPlayer(video.url, player => {
    console.log('Video player initialized:', {
      videoId: video.id,
      url: video.url,
      shouldLoop: true
    });
    player.loop = true;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Debug logging for player state changes
  useEffect(() => {
    console.log('Player State Change:', {
      videoId: video.id,
      status,
      isPlaying,
      shouldPlay
    });
  }, [status, isPlaying, shouldPlay]);

  useEffect(() => {
    console.log('Playback state update:', {
      videoId: video.id,
      shouldPlay,
      manuallyPaused,
      isActive,
      isInHomeTab
    });

    if (shouldPlay && status === 'readyToPlay' && !isPlaying) {
      player.play();
    } else if (!shouldPlay && isPlaying) {
      player.pause();
    }
  }, [shouldPlay, status, isPlaying]);

  useEffect(() => {
    const checkSavedStatus = async () => {
      if (auth.currentUser) {
        const isSaved = await isVideoSaved(auth.currentUser.uid, video.id);
        setSaved(isSaved);
      }
    };
    checkSavedStatus();
  }, [video.id]);

  useEffect(() => {
    if (video.subjectId && auth.currentUser) {
      SubjectService.getSubjectById(video.subjectId, auth.currentUser.uid)
        .then(setSubject)
        .catch(console.error);
    }
  }, [video.subjectId]);

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
    console.log('Manual play/pause triggered:', {
      videoId: video.id,
      currentlyPlaying: isPlaying,
      manuallyPaused
    });
    
    if (isPlaying) {
      player.pause();
      setManuallyPaused(true);
    } else {
      setManuallyPaused(false);
      player.play();
    }
  };

  
  const handleLearn = () => {
    setLearningPanelVisible(true);
  };

  const handleCommentsPress = () => {
    setCommentSectionVisible(true);
  };

  const handleQuizGenerated = (newQuiz: Quiz) => {
    setCurrentQuiz(newQuiz);
  };

  return (
    <View style={[styles.container, containerHeight ? { height: containerHeight } : null]}>
      <TouchableOpacity 
        style={styles.videoContainer} 
        onPress={handlePlayPause}
        activeOpacity={1}
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
            
            {subject && (
              <TouchableOpacity 
                style={styles.subjectTag}
                onPress={() => router.push(`/subject/${subject.id}`)}
              >
                <Text style={styles.subjectText}>{subject.name}</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.conceptsContainer}>
              {video.conceptIds?.map((conceptId, index) => (
                <TouchableOpacity 
                  key={conceptId}
                  style={styles.conceptTag}
                  onPress={() => router.push(`/concept/${conceptId}`)}
                >
                  <Text style={styles.conceptText}>
                    {subject?.concepts?.find(c => c.id === conceptId)?.name || `Concept ${index + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
        summary={video.summary}
        furtherReading={video.furtherReading}
        quiz={currentQuiz}
        transcription={video.transcription}
        transcriptionStatus={video.transcriptionStatus}
        onQuizGenerated={handleQuizGenerated}
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
    height: '100%',
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
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
    bottom: 60,
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
    marginBottom: 16,
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
  subjectTag: {
    backgroundColor: '#1a472a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  subjectText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  conceptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  conceptTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  conceptText: {
    color: '#fff',
    fontSize: 12,
  },
}); 