import React from 'react';
import { View, Image, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Video } from '../types/video';

interface VideoThumbnailProps {
  video: Video;
  onPress?: () => void;
}

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const THUMBNAIL_ASPECT_RATIO = 16 / 9;
const THUMBNAIL_WIDTH = WINDOW_WIDTH - 32; // Full width minus padding
const THUMBNAIL_HEIGHT = THUMBNAIL_WIDTH / THUMBNAIL_ASPECT_RATIO;

export default function VideoThumbnail({ video, onPress }: VideoThumbnailProps) {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      <Image
        source={{ uri: video.thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.duration}>
        <Text style={styles.durationText}>
          {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: THUMBNAIL_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  duration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
}); 