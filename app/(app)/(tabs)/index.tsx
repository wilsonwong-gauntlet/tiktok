import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, FlatList, StyleSheet, Dimensions, ActivityIndicator, Text, TouchableOpacity, ViewToken } from 'react-native';
import { Video, VideoFeed } from '../../../types/video';
import { VideoService } from '../../../services/firebase/video';
import VideoCard from '../../../components/VideoCard';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 49; // Standard tab bar height

export default function Home() {
  const insets = useSafeAreaInsets();
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const [feedState, setFeedState] = useState<VideoFeed>({
    videos: [],
    loading: true,
    error: undefined,
  });
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<any> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Calculate screen height accounting for only tab bar and safe areas
  const SCREEN_HEIGHT = WINDOW_HEIGHT - TAB_BAR_HEIGHT - insets.bottom;

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    if (videoId && feedState.videos.length > 0) {
      const index = feedState.videos.findIndex(v => v.id === videoId);
      if (index !== -1) {
        setCurrentIndex(index);
      } else {
        // If video is not in current feed, load it specifically
        loadVideoById(videoId);
      }
    }
  }, [videoId, feedState.videos]);

  const loadVideos = async (loadMore = false) => {
    try {
      if (loadMore && !lastVisible) return;

      setFeedState(prev => ({ ...prev, loading: true, error: undefined }));
      const result = await VideoService.fetchVideos(loadMore && lastVisible ? lastVisible : undefined);
      
      setFeedState(prev => ({
        videos: loadMore ? [...prev.videos, ...result.videos] : result.videos,
        loading: false,
        error: undefined,
      }));
      setLastVisible(result.lastVisible);
    } catch (error) {
      console.error('Error in loadVideos:', error);
      setFeedState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load videos',
      }));
    }
  };

  const loadVideoById = async (id: string) => {
    try {
      const video = await VideoService.fetchVideoById(id);
      if (video) {
        setFeedState(prev => ({
          ...prev,
          videos: [video, ...prev.videos],
        }));
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Error loading video:', error);
    }
  };

  const handleAddSampleVideos = async () => {
    try {
      await VideoService.addSampleVideos();
      loadVideos();
    } catch (error) {
      console.error('Error adding sample videos:', error);
    }
  };

  const handleVideoComplete = useCallback(() => {
    console.log('Video completed in home feed');
    // Refresh the feed to update any UI that depends on completion status
    loadVideos();
  }, []);

  const onViewableItemsChanged = React.useCallback(({ 
    viewableItems 
  }: {
    viewableItems: ViewToken[];
    changed: ViewToken[];
  }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      console.log('Active video changed:', {
        previousIndex: currentIndex,
        newIndex: viewableItems[0].index,
        videoId: viewableItems[0].item?.id
      });
      setCurrentIndex(viewableItems[0].index);
    }
  }, [currentIndex]);

  const viewabilityConfig = React.useMemo(() => ({
    itemVisiblePercentThreshold: 50
  }), []);

  const renderVideo = ({ item, index }: { item: Video; index: number }) => (
    <View style={[styles.videoContainer, { height: SCREEN_HEIGHT }]}>
      <VideoCard 
        video={item} 
        isActive={index === currentIndex} 
        onVideoComplete={handleVideoComplete}
      />
    </View>
  );

  if (feedState.loading && !feedState.videos.length) {
    return (
      <View style={[styles.centerContainer, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (feedState.error && !feedState.videos.length) {
    return (
      <View style={[styles.centerContainer, { paddingBottom: insets.bottom }]}>
        <Text style={styles.errorText}>{feedState.error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadVideos()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.retryButton} onPress={handleAddSampleVideos}>
          <Text style={styles.retryText}>Add Sample Videos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!feedState.videos.length) {
    return (
      <View style={[styles.centerContainer, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.retryButton} onPress={handleAddSampleVideos}>
          <Text style={styles.retryText}>Add Sample Videos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feedState.videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        onEndReached={() => loadVideos(true)}
        onEndReachedThreshold={0.5}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        removeClippedSubviews={true}
        windowSize={3}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={100}
        initialNumToRender={2}
        ListFooterComponent={() =>
          feedState.loading ? (
            <View style={[styles.footer, { height: SCREEN_HEIGHT }]}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    width: WINDOW_WIDTH,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  footer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
}); 