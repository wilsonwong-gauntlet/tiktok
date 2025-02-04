import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Dimensions, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { Video, VideoFeed } from '../../types/video';
import { VideoService } from '../../services/firebase/video';
import VideoCard from '../../components/VideoCard';
import { QueryDocumentSnapshot } from 'firebase/firestore';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 49; // Standard tab bar height
const SCREEN_HEIGHT = WINDOW_HEIGHT - TAB_BAR_HEIGHT;

export default function Home() {
  const [feedState, setFeedState] = useState<VideoFeed>({
    videos: [],
    loading: true,
    error: undefined,
  });
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<any> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadVideos();
  }, []);

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

  const handleAddSampleVideos = async () => {
    try {
      await VideoService.addSampleVideos();
      loadVideos();
    } catch (error) {
      console.error('Error adding sample videos:', error);
    }
  };

  const onViewableItemsChanged = React.useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = React.useMemo(() => ({
    itemVisiblePercentThreshold: 50
  }), []);

  const renderVideo = ({ item, index }: { item: Video; index: number }) => (
    <VideoCard video={item} isActive={index === currentIndex} />
  );

  if (feedState.loading && !feedState.videos.length) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (feedState.error && !feedState.videos.length) {
    return (
      <View style={styles.centerContainer}>
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
      <View style={styles.centerContainer}>
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
            <View style={styles.footer}>
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
    height: SCREEN_HEIGHT,
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