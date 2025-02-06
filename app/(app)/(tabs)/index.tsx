import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoService } from '../../../services/firebase/video';
import { Video } from '../../../types/video';
import VideoCard from '../../../components/VideoCard';

export default function HomeScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const result = await VideoService.fetchVideos();
      setVideos(result.videos);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={videos}
        renderItem={({ item }) => (
          <VideoCard 
            video={item} 
            isActive={item.id === activeVideoId}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        onRefresh={loadVideos}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  content: {
    padding: 10,
  },
}); 