import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  TextStyle,
  ViewStyle,
  SafeAreaView,
  Platform
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Subject, Video } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { VideoService } from '../../../services/firebase/video';
import { auth, db } from '../../../services/firebase';
import { collection, doc, getDoc, getDocs, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { useTheme } from '../../../hooks/useTheme';
import { VideoThumbnail } from '../../../components/VideoThumbnail';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

type TabType = 'overview' | 'summaries' | 'quizzes' | 'reflections' | 'reading';

type FilterOptions = {
  searchQuery: string;
};

interface SubjectProgress {
  userId: string;
  subjects: {
    [subjectId: string]: {
      progress: number;
      lastActivity: Timestamp;
      completedVideos: string[];
    }
  };
  completedVideos: number;
  totalVideos: number;
  lastActivity: Date | null;
  streakDays: number;
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  overviewContainer: {
    flex: 1,
  },
  headerSection: {
    marginBottom: 24,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  emptyState: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 12,
    color: '#666',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  retryButton: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  progressContainer: {
    marginTop: 16,
    width: '100%',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#9580FF',
  },
  progressText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const theme = useTheme();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [watchedCount, setWatchedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    searchQuery: '',
  });

  useEffect(() => {
    if (!auth.currentUser || !id) return;

    // Set up real-time listener for progress updates
    const progressRef = doc(db, 'users', auth.currentUser.uid, 'progress', 'learning');
    const unsubscribe = onSnapshot(progressRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // Get completed videos for this subject
        const completedVideos = data?.subjects?.[id as string]?.completedVideos || [];
        setWatchedCount(completedVideos.length);
      } else {
        setWatchedCount(0);
      }
    });

    return () => unsubscribe();
  }, [id, auth.currentUser]);

  useEffect(() => {
    loadSubjectAndVideos();
  }, [id]);

  const loadSubjectAndVideos = async () => {
    if (!auth.currentUser || !id) {
      console.log('Missing required data:', { auth: !!auth.currentUser, id });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Load subject data
      const subjectData = await SubjectService.getSubjectById(id as string, auth.currentUser.uid);
      if (!subjectData) {
        console.error('Subject not found:', id);
        setError('Subject not found');
        setLoading(false);
        return;
      }

      setSubject(subjectData);

      // Load videos
      const subjectVideos = await VideoService.getVideosBySubject(id as string);
      setVideos(subjectVideos);
      setFilteredVideos(subjectVideos);

    } catch (error) {
      console.error('Error loading subject:', error);
      setError('Failed to load subject');
    } finally {
      setLoading(false);
    }
  };

  const filterVideos = useCallback((videosToFilter: Video[]) => {
    return videosToFilter.filter(video => {
      const matchesSearch = filterOptions.searchQuery === '' ||
        video.title.toLowerCase().includes(filterOptions.searchQuery.toLowerCase()) ||
        video.description.toLowerCase().includes(filterOptions.searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [filterOptions]);

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={20} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search videos..."
        placeholderTextColor="#666"
        value={filterOptions.searchQuery}
        onChangeText={(text) => {
          setFilterOptions(prev => ({ ...prev, searchQuery: text }));
          const filtered = filterVideos(videos);
          setFilteredVideos(filtered);
        }}
      />
    </View>
  );

  const renderOverviewTab = () => (
    <ScrollView style={styles.overviewContainer}>
      <View style={styles.headerSection}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{videos.length}</Text>
            <Text style={styles.statLabel}>Total Videos</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar,
                    { width: `${videos.length > 0 ? (watchedCount / videos.length) * 100 : 0}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {watchedCount} / {videos.length} watched
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Video Sections */}
      {renderSearchBar()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Videos</Text>
        {filteredVideos.length > 0 ? (
          <View style={styles.videoGrid}>
            {filteredVideos.map(video => (
              <VideoThumbnail
                key={video.id}
                video={video}
                onPress={() => router.push({
                  pathname: '/video/[id]',
                  params: { id: video.id }
                })}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {filterOptions.searchQuery ? 'No videos match your search' : 'No videos available yet'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9580FF" />
          <Text style={styles.loadingText}>Loading subject...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !subject) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF453A" />
          <Text style={styles.errorText}>{error || 'Subject not found'}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadSubjectAndVideos}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{subject.name}</Text>
      </View>

      <View style={styles.content}>
        {renderOverviewTab()}
      </View>
    </SafeAreaView>
  );
}
