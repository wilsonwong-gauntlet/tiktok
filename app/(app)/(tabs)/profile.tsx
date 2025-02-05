import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../../services/firebase/index';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { fetchSavedVideos } from '../../../services/firebase/index';
import { Video } from '../../../types/video';
import { useVideoSave } from '../../../contexts/VideoSaveContext';

export default function Profile() {
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useVideoSave();

  // Listen for video save changes
  useEffect(() => {
    const unsubscribe = subscribe((videoId) => {
      loadSavedVideos();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadSavedVideos();
  }, []);

  const loadSavedVideos = async () => {
    if (!auth.currentUser) return;
    
    try {
      setLoading(true);
      const videos = await fetchSavedVideos(auth.currentUser.uid);
      setSavedVideos(videos);
    } catch (error) {
      console.error('Error loading saved videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleVideoPress = (videoId: string) => {
    router.push({
      pathname: "/(app)/(tabs)",
      params: { videoId }
    });
  };

  if (!auth.currentUser) {
    router.replace('/login');
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={80} color="#fff" />
          </View>
          <Text style={styles.email}>{auth.currentUser?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Videos</Text>
          <View style={styles.savedVideosContainer}>
            {loading ? (
              <Text style={styles.text}>Loading...</Text>
            ) : savedVideos.length === 0 ? (
              <Text style={styles.text}>No saved videos yet</Text>
            ) : (
              <View style={styles.videoGrid}>
                {savedVideos.map(video => (
                  <TouchableOpacity
                    key={video.id}
                    style={styles.videoCard}
                    onPress={() => handleVideoPress(video.id)}
                  >
                    <Image
                      source={{ uri: video.thumbnailUrl }}
                      style={styles.thumbnail}
                    />
                    <Text style={styles.videoTitle} numberOfLines={2}>
                      {video.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  avatarContainer: {
    marginBottom: 10,
  },
  email: {
    color: '#fff',
    fontSize: 16,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  savedVideosContainer: {
    padding: 10,
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  videoCard: {
    width: '48%',
    marginBottom: 15,
    backgroundColor: '#111',
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#222',
  },
  videoTitle: {
    color: '#fff',
    fontSize: 14,
    padding: 8,
  },
  text: {
    color: '#666',
    fontSize: 16,
  },
  signOutButton: {
    margin: 20,
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 