import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Video as VideoType, Subject, Quiz, FurtherReading } from '../types/video';
import { auth, saveVideo, unsaveVideo, isVideoSaved } from '../services/firebase/index';
import { useEvent } from 'expo';
import LearningPanel from './LearningPanel';
import CommentSection from './CommentSection';
import { useVideoSave } from '../contexts/VideoSaveContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { SubjectService } from '../services/firebase/subjects';
import { VideoService } from '../services/firebase/video';
import CoachingPrompts from './CoachingPrompts';
import Slider from '@react-native-community/slider';

interface VideoCardProps {
  video: VideoType;
  isActive: boolean;
  containerHeight?: number;
  isModal?: boolean;
  onVideoComplete?: () => void;
}

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 49; // Standard tab bar height
const SCREEN_HEIGHT = WINDOW_HEIGHT - TAB_BAR_HEIGHT;

const COMPLETION_THRESHOLD = 0.9; // Mark video as complete when 90% watched

// Memoize child components
const MemoizedCoachingPrompts = memo(CoachingPrompts);
const MemoizedLearningPanel = memo(LearningPanel);
const MemoizedCommentSection = memo(CommentSection);

const VideoProgressBar = memo(({ currentTime, duration, onSeek, isActive }: {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isActive: boolean;
}) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const insets = useSafeAreaInsets();

  if (!isActive) return null;

  return (
    <View style={[
      styles.progressContainer,
      { paddingBottom: Math.max(16, insets.bottom + 8) }
    ]}>
      <Slider
        style={styles.slider}
        value={isScrubbing ? scrubPosition : currentTime}
        minimumValue={0}
        maximumValue={duration}
        minimumTrackTintColor="#1a472a"
        maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
        thumbTintColor="#1a472a"
        onSlidingStart={(value: number) => {
          setIsScrubbing(true);
          setScrubPosition(value);
        }}
        onValueChange={(value: number) => {
          setScrubPosition(value);
        }}
        onSlidingComplete={(value: number) => {
          setIsScrubbing(false);
          onSeek(value);
        }}
      />
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>
          {formatTime(isScrubbing ? scrubPosition : currentTime)}
        </Text>
        <Text style={styles.timeText}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
});

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function VideoCard({ video, isActive, containerHeight, isModal = false, onVideoComplete }: VideoCardProps) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);
  const [learningPanelVisible, setLearningPanelVisible] = useState(false);
  const [commentSectionVisible, setCommentSectionVisible] = useState(false);
  const { notifyVideoSaveChanged } = useVideoSave();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const pathname = usePathname();
  const [currentQuiz, setCurrentQuiz] = useState(video.quiz);
  const [furtherReading, setFurtherReading] = useState(video.furtherReading);
  const [currentTime, setCurrentTime] = useState(0);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const videoRef = useRef<VideoView>(null);
  const [duration, setDuration] = useState(0);

  // Optimize currentTime updates with useRef to avoid re-renders
  const timeRef = useRef(0);

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

  // Add duration tracking
  useEffect(() => {
    if (player && status === 'readyToPlay') {
      setDuration(player.duration);
    }
  }, [player, status]);

  // Optimize video time tracking with duration
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (status === 'readyToPlay' && isPlaying) {
        const time = player.currentTime;
        timeRef.current = time;
        setCurrentTime(time);
      }
    }, 250); // Update more frequently for smoother progress

    return () => clearInterval(interval);
  }, [player, status, isPlaying]);

  // Track video completion
  useEffect(() => {
    if (!player || !auth.currentUser || !video.subjectId) return;

    const interval = setInterval(() => {
      if (status === 'readyToPlay' && isPlaying) {
        const progress = player.currentTime / player.duration;
        console.log('Video progress:', {
          currentTime: player.currentTime,
          duration: player.duration,
          progress: progress,
          threshold: COMPLETION_THRESHOLD
        });
        
        // Mark video as completed when user watches 90% or reaches the end
        if (progress >= COMPLETION_THRESHOLD) {
          console.log('Video reached completion threshold');
          const currentUser = auth.currentUser;
          if (!currentUser) {
            console.error('User not authenticated');
            return;
          }
          
          VideoService.markVideoCompleted(currentUser.uid, video.id, video.subjectId)
            .then(() => {
              console.log('Successfully marked video as completed');
              // Call the onVideoComplete callback if provided
              onVideoComplete?.();
              // Also refresh the learning data if the function exists
              if (typeof window !== 'undefined' && (window as any).refreshLearningData) {
                (window as any).refreshLearningData();
              }
            })
            .catch(error => console.error('Error marking video as completed:', error));
          // Clear interval after marking complete
          clearInterval(interval);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [player, status, isPlaying, video.id, video.subjectId, onVideoComplete]);

  // Memoize handlers
  const handleSave = useCallback(async () => {
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
  }, [saved, video.id]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setManuallyPaused(true);
    } else {
      setManuallyPaused(false);
      player.play();
    }
  }, [isPlaying, player]);

  const handleLearn = useCallback(() => {
    setLearningPanelVisible(true);
  }, []);

  const handleCommentsPress = useCallback(() => {
    setCommentSectionVisible(true);
  }, []);

  const handleQuizGenerated = (newQuiz: Quiz) => {
    setCurrentQuiz(newQuiz);
  };

  const handleFurtherReadingGenerated = (recommendations: FurtherReading[]) => {
    console.log('Setting further reading:', recommendations);
    setFurtherReading(recommendations);
  };

  const handleGeneratePrompts = useCallback(async () => {
    try {
      setIsGeneratingPrompts(true);
      await VideoService.generateCoachingPrompts(video.id);
      const updatedVideo = await VideoService.fetchVideoById(video.id);
      if (updatedVideo) {
        video.coachingPrompts = updatedVideo.coachingPrompts;
      }
    } catch (error) {
      console.error('Error generating prompts:', error);
    } finally {
      setIsGeneratingPrompts(false);
    }
  }, [video.id]);

  const handleSeek = useCallback((time: number) => {
    if (player && status === 'readyToPlay') {
      // Ensure time is within valid bounds
      const boundedTime = Math.max(0, Math.min(time, player.duration));
      const seekAmount = boundedTime - player.currentTime;
      
      // Only seek if the change is significant enough (more than 0.5 seconds)
      if (Math.abs(seekAmount) > 0.5) {
        player.seekBy(seekAmount);
        setCurrentTime(boundedTime);
      }
    }
  }, [player, status]);

  return (
    <View style={[styles.container, containerHeight ? { height: containerHeight } : null]}>
      <TouchableOpacity 
        style={styles.videoContainer} 
        onPress={handlePlayPause}
        activeOpacity={1}
      >
        <VideoView
          ref={videoRef}
          style={[styles.video, { height: containerHeight || SCREEN_HEIGHT }]}
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

      <MemoizedLearningPanel
        visible={learningPanelVisible}
        onClose={useCallback(() => setLearningPanelVisible(false), [])}
        title={video.title}
        videoId={video.id}
        video={video}
        subjectId={video.subjectId}
        summary={video.summary}
        furtherReading={furtherReading}
        quiz={currentQuiz}
        transcription={video.transcription}
        transcriptionStatus={video.transcriptionStatus}
        onQuizGenerated={handleQuizGenerated}
        onFurtherReadingGenerated={handleFurtherReadingGenerated}
      />

      <MemoizedCommentSection
        visible={commentSectionVisible}
        onClose={useCallback(() => setCommentSectionVisible(false), [])}
        videoId={video.id}
      />

      <MemoizedCoachingPrompts
        prompts={video.coachingPrompts || []}
        currentTime={timeRef.current}
        onGeneratePrompts={handleGeneratePrompts}
        isGenerating={isGeneratingPrompts}
      />

      <VideoProgressBar
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        isActive={isActive}
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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
    marginBottom: 80,
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
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  slider: {
    width: '100%',
    height: 32,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
}); 