import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Dimensions, ActivityIndicator, Text } from 'react-native';
import { Video, VideoFeed } from '../../types/video';
import { fetchVideos } from '../../services/firebase';
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
      
      setFeedState(prev => ({
        videos: loadMore ? [...prev.videos, ...result.videos] : result.videos,
        loading: false,
        error: undefined,
      }));
      setLastVisible(result.lastVisible);
    } catch (error) {
      setFeedState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load videos',
      }));
    }
  };

  const renderVideo = ({ item }: { item: Video }) => (
    <VideoCard video={item} />
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
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
  errorText: {
    color: '#fff',
    fontSize: 16,
  },
  footer: {
    padding: 20,
  },
}); 