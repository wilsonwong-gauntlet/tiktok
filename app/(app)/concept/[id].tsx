import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, Concept } from '../../../types/video';
import { VideoService } from '../../../services/firebase/video';
import VideoThumbnail from '../../../components/VideoThumbnail';
import { db } from '../../../services/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';

export default function ConceptDetailScreen() {
  const { id } = useLocalSearchParams();
  const [concept, setConcept] = useState<Concept | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConceptAndVideos();
  }, [id]);

  const loadConceptAndVideos = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      // Load concept data
      const conceptRef = doc(db, 'concepts', id as string);
      const conceptDoc = await getDoc(conceptRef);
      if (!conceptDoc.exists()) {
        setError('Concept not found');
        return;
      }
      
      setConcept({
        id: conceptDoc.id,
        ...conceptDoc.data()
      } as Concept);

      // Load related videos
      const conceptVideos = await VideoService.getVideosByConcept(id as string);
      setVideos(conceptVideos);
    } catch (error) {
      console.error('Error loading concept:', error);
      setError('Failed to load concept');
    } finally {
      setLoading(false);
    }
  };

  const renderVideo = (video: Video) => (
    <TouchableOpacity 
      key={video.id}
      style={styles.videoCard}
      onPress={() => router.push(`/?videoId=${video.id}`)}
    >
      <VideoThumbnail video={video} />
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.videoAuthor}>{video.authorName}</Text>
        <View style={styles.videoMetadata}>
          <Text style={styles.videoViews}>{video.viewCount} views</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  if (error || !concept) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Concept not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConceptAndVideos}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{concept.name}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>{concept.description}</Text>

        <View style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(concept.status) }]}>
            <Text style={styles.statusText}>
              {concept.status.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </Text>
          </View>
        </View>

        {concept.prerequisites.length > 0 && (
          <View style={styles.prerequisitesSection}>
            <Text style={styles.sectionTitle}>Prerequisites</Text>
            <View style={styles.prerequisites}>
              {concept.prerequisites.map(prereqId => (
                <TouchableOpacity
                  key={prereqId}
                  style={styles.prerequisiteTag}
                  onPress={() => router.push(`/concept/${prereqId}`)}
                >
                  <Text style={styles.prerequisiteText}>
                    {/* You would need to fetch the prerequisite name */}
                    Prerequisite {prereqId}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.videosSection}>
          <Text style={styles.sectionTitle}>Related Videos</Text>
          {videos.length > 0 ? (
            <View style={styles.videoGrid}>
              {videos.map(renderVideo)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No videos available yet</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'mastered':
      return '#2E7D32';
    case 'in_progress':
      return '#F57F17';
    default:
      return '#666';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 24,
    lineHeight: 24,
  },
  statusSection: {
    marginBottom: 24,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  prerequisitesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  prerequisites: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prerequisiteTag: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  prerequisiteText: {
    color: '#fff',
    fontSize: 14,
  },
  videosSection: {
    marginBottom: 24,
  },
  videoGrid: {
    gap: 16,
  },
  videoCard: {
    backgroundColor: '#222',
    borderRadius: 10,
    overflow: 'hidden',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  videoAuthor: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  videoMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoViews: {
    fontSize: 12,
    color: '#666',
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
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
}); 