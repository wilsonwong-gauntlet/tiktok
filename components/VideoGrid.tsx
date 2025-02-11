import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Video } from '../types/video';
import { VideoService } from '../services/firebase/video';
import VideoThumbnail from './VideoThumbnail';
import { router } from 'expo-router';

interface VideoGridProps {
  subjectId: string;
}

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const GRID_SPACING = 16;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (WINDOW_WIDTH - GRID_SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

export default function VideoGrid({ subjectId }: VideoGridProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, [subjectId]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const subjectVideos = await VideoService.getVideosBySubject(subjectId);
      setVideos(subjectVideos);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoPress = (videoId: string) => {
    router.push(`/video/${videoId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a472a" />
      </View>
    );
  }

  return (
    <FlatList
      data={videos}
      numColumns={NUM_COLUMNS}
      renderItem={({ item }) => (
        <View style={styles.gridItem}>
          <VideoThumbnail
            video={item}
            onPress={() => handleVideoPress(item.id)}
          />
        </View>
      )}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.grid}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    padding: GRID_SPACING,
  },
  gridItem: {
    width: ITEM_WIDTH,
    marginBottom: GRID_SPACING,
    marginHorizontal: GRID_SPACING / 2,
  },
}); 