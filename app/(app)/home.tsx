import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Dimensions, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { Video, VideoFeed } from '../../types/video';
import { fetchVideos, addSampleVideos } from '../../services/firebase';
import VideoCard from '../../components/VideoCard';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

export default function Home() {
  const [feedState, setFeedState] = useState<VideoFeed>({
    videos: [],
    loading: true,
    error: undefined,
  });
  const [lastVisible, setLastVisible] = useState<any>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async (loadMore = false) => {
    try {
      if (loadMore && !lastVisible) return;

      setFeedState(prev => ({ ...prev, loading: true, error: undefined }));
      const result = await fetchVideos(loadMore ? lastVisible : undefined);
      console.log('Loaded videos:', result.videos.length);
      console.log('First video details:', result.videos[0]);
      
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
      await addSampleVideos();
      loadVideos(); // Reload videos after adding samples
    } catch (error) {
      console.error('Error adding sample videos:', error);
    }
  };

  const renderVideo = ({ item }: { item: Video }) => (
    <VideoCard video={item} />
  );

  if (feedState.loading && !feedState.videos.length) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.debugText}>Loading videos...</Text>
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
        <Text style={styles.debugText}>No videos found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadVideos()}>
          <Text style={styles.retryText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.retryButton} onPress={handleAddSampleVideos}>
          <Text style={styles.retryText}>Add Sample Videos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.debugText}>Videos loaded: {feedState.videos.length}</Text>
      </View>
      <FlatList
        data={feedState.videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        onEndReached={() => loadVideos(true)}
        onEndReachedThreshold={0.5}
        snapToInterval={height}
        decelerationRate="fast"
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50
        }}
        ListFooterComponent={() =>
          feedState.loading ? (
            <View style={styles.footer}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
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
  header: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  debugText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
  },
  footer: {
    padding: 20,
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