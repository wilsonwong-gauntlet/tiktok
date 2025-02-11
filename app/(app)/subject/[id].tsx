import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Subject, Video } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { VideoService } from '../../../services/firebase/video';
import { auth } from '../../../services/firebase';

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubject();
  }, [id]);

  const loadSubject = async () => {
    if (!auth.currentUser || !id) return;

    try {
      setLoading(true);
      setError(null);
      
      const subjectData = await SubjectService.getSubjectById(id as string, auth.currentUser.uid);
      if (!subjectData) {
        setError('Subject not found');
        return;
      }

      setSubject(subjectData);
      const subjectVideos = await VideoService.getVideosBySubject(id as string);
      setVideos(subjectVideos);

    } catch (error) {
      console.error('Error loading subject:', error);
      setError('Failed to load subject');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Loading...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9580FF" />
        </View>
      </View>
    );
  }

  if (error || !subject) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Error</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Subject not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSubject}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{subject.name}</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.subjectInfo}>
          <Text style={styles.videoCount}>{videos.length} videos</Text>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.mainCardHeader}>
            <Ionicons name="play-circle" size={24} color="#9580FF" />
            <Text style={styles.mainCardTitle}>Video Lessons</Text>
          </View>
          
          <View style={styles.videoList}>
            {videos.map((video, index) => (
              <TouchableOpacity
                key={video.id}
                style={styles.videoRow}
                onPress={() => router.push(`/video/${video.id}`)}
              >
                <View style={styles.videoContent}>
                  <View style={styles.videoLeft}>
                    <Text style={styles.videoTitle}>{video.title}</Text>
                    {video.completed && (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#9580FF" />
                        <Text style={styles.completedText}>Completed</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#666" />
                </View>
                {index < videos.length - 1 && <View style={styles.videoSeparator} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.toolsGrid}>
          <TouchableOpacity 
            style={styles.toolCard}
            onPress={() => router.push(`/summaries/${subject.id}`)}
          >
            <Ionicons name="document-text" size={24} color="#9580FF" />
            <Text style={styles.toolTitle}>Summaries</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toolCard}
            onPress={() => router.push(`/quizzes/${subject.id}`)}
          >
            <Ionicons name="checkmark-circle" size={24} color="#9580FF" />
            <Text style={styles.toolTitle}>Quizzes</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toolCard}
            onPress={() => router.push(`/reading/${subject.id}`)}
          >
            <Ionicons name="book" size={24} color="#9580FF" />
            <Text style={styles.toolTitle}>Reading</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toolCard}
            onPress={() => router.push(`/notes/${subject.id}`)}
          >
            <Ionicons name="journal" size={24} color="#9580FF" />
            <Text style={styles.toolTitle}>Notes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  subjectInfo: {
    padding: 16,
  },
  videoCount: {
    fontSize: 16,
    color: '#666',
  },
  mainCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  mainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  mainCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  videoList: {
    paddingVertical: 8,
  },
  videoRow: {
    paddingHorizontal: 16,
  },
  videoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  videoLeft: {
    flex: 1,
    gap: 4,
  },
  videoTitle: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  videoSeparator: {
    height: 1,
    backgroundColor: '#222',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    color: '#9580FF',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
  },
  toolCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 20,
    width: '47%',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
}); 