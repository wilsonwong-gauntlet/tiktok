import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Video } from '../../../types/video';
import { VideoService } from '../../../services/firebase/video';
import VideoCard from '../../../components/VideoCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS
} from 'react-native-reanimated';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 150;

export default function VideoViewer() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [video, setVideo] = useState<Video | null>(null);
  const translateY = useSharedValue(0);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    if (!id) return;
    try {
      const videoData = await VideoService.fetchVideoById(id as string);
      if (videoData) {
        setVideo(videoData);
      }
    } catch (error) {
      console.error('Error loading video:', error);
    }
  };

  const handleDismiss = () => {
    router.back();
  };

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      // Only allow pulling down
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD) {
        runOnJS(handleDismiss)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!video) {
    return null;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {/* Pull indicator */}
        <View style={styles.pullIndicatorContainer}>
          <View style={styles.pullIndicator} />
        </View>

        {/* Close button */}
        <TouchableOpacity 
          style={[styles.closeButton, { top: insets.top + 10 }]} 
          onPress={handleDismiss}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <VideoCard 
          video={video} 
          isActive={true}
          isModal={true}
          containerHeight={WINDOW_HEIGHT}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    height: WINDOW_HEIGHT,
  },
  pullIndicatorContainer: {
    position: 'absolute',
    top: 12,
    width: '100%',
    zIndex: 10,
    alignItems: 'center',
  },
  pullIndicator: {
    width: 36,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 