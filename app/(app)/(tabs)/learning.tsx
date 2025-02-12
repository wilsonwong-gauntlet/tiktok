import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Subject, UserProgress, FurtherReading, Quiz, QuizAttempt, Note, QuizQuestion, Video } from '../../../types/video';
import { auth, db } from '../../../services/firebase';
import { VideoService } from '../../../services/firebase/video';
import { SubjectService } from '../../../services/firebase/subjects';
import ReadingList from '../../../components/ReadingList';
import SavedInsights from '../../../components/SavedInsights';
import QuizList from '../../../components/QuizList';
import NotesList from '../../../components/NotesList';
import { collection, getDocs, query, where } from 'firebase/firestore';

type Tab = 'overview' | 'reading' | 'quizzes' | 'notes' | 'insights';

interface ReadingItem {
  videoId: string;
  videoTitle: string;
  subjectName: string;
  resource: FurtherReading;
}

interface CachedData {
  readings: ReadingItem[];
  quizzes: {
    id: string;
    videoId: string;
    videoTitle: string;
    subjectName: string;
    questions: QuizQuestion[];
    lastAttempt?: QuizAttempt;
  }[];
  notes: {
    id: string;
    videoId: string;
    videoTitle: string;
    subjectName: string;
    content: string;
    timestamp: number;
    createdAt: Date;
  }[];
  insights: {
    videoId: string;
    summary: string;
    confusionPoints: string[];
    valuableInsights: string[];
    sentiment: string;
    commentCount: number;
    savedAt: Date;
    videoTitle?: string;
  }[];
  lastFetched: {
    readings?: number;
    quizzes?: number;
    notes?: number;
    insights?: number;
  };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export default function LearningScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [activeSubjects, setActiveSubjects] = useState<Subject[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cachedData, setCachedData] = useState<CachedData>({
    readings: [],
    quizzes: [],
    notes: [],
    insights: [],
    lastFetched: {},
  });
  const [refreshing, setRefreshing] = useState(false);

  // Expose refresh function globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).refreshLearningData = loadInitialData;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).refreshLearningData;
      }
    };
  }, []);

  // Load initial data
  useEffect(() => {
    if (!auth.currentUser) return;
    loadInitialData();
  }, []);

  // Handle tab changes
  useEffect(() => {
    if (!auth.currentUser) return;
    loadTabData();
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      console.log('Loading initial data...');
      const [progressData, subjects, videosData] = await Promise.all([
        SubjectService.getUserProgress(auth.currentUser!.uid),
        SubjectService.getActiveSubjects(auth.currentUser!.uid),
        VideoService.fetchVideos(),
      ]);

      console.log('User Progress Data:', progressData);
      console.log('Active Subjects:', subjects);
      console.log('Videos Data:', videosData);

      setUserProgress(progressData);
      setActiveSubjects(subjects);
      setVideos(videosData.videos);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTabData = async (bypassCache: boolean = false) => {
    if (!auth.currentUser) return;
    
    // Don't load data for overview tab
    if (activeTab === 'overview') return;

    // Map tab names to their cache keys
    const cacheKey = {
      reading: 'readings',
      quizzes: 'quizzes',
      notes: 'notes',
      insights: 'insights'
    } as const;
    
    // Check if we have valid cached data
    const lastFetched = cachedData.lastFetched[cacheKey[activeTab]];
    const isCacheValid = !bypassCache && lastFetched && (Date.now() - lastFetched) < CACHE_DURATION;
    
    if (isCacheValid) {
      console.log('Using cached data for', activeTab);
      return;
    }

    // Check for existing data to avoid loading state
    const hasExistingData = activeTab === 'reading' 
      ? cachedData.readings.length > 0
      : cachedData[activeTab].length > 0;

    if (!hasExistingData) {
      setIsLoading(true);
    }
    
    try {
      let newData;
      switch (activeTab) {
        case 'reading':
          newData = await loadReadingResources();
          break;
        case 'quizzes':
          newData = await loadQuizzes();
          break;
        case 'notes':
          newData = await loadNotes();
          break;
        case 'insights':
          newData = await loadInsights();
          break;
      }

      if (newData) {
        setCachedData(prev => ({
          ...prev,
          [activeTab === 'reading' ? 'readings' : activeTab]: newData,
          lastFetched: { 
            ...prev.lastFetched, 
            [cacheKey[activeTab]]: Date.now() 
          }
        }));
      }
    } catch (error) {
      console.error('Error loading tab data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuizzes = async () => {
    if (!auth.currentUser) return [];

    try {
      // Get all videos that have quizzes
      const videosRef = collection(db, 'videos');
      const videosSnapshot = await getDocs(query(videosRef, where('quiz', '!=', null)));
      
      // Get all quiz attempts for the current user
      const attemptsRef = collection(db, 'quizAttempts');
      const attemptsSnapshot = await getDocs(
        query(attemptsRef, where('userId', '==', auth.currentUser.uid))
      );

      // Create a map of quiz attempts
      const attempts = new Map(
        attemptsSnapshot.docs.map(doc => {
          const data = doc.data() as QuizAttempt;
          return [data.quizId, data];
        })
      );

      // Get all subject names
      const subjectIds = new Set(videosSnapshot.docs.map(doc => doc.data().subjectId));
      const subjectsRef = collection(db, 'subjects');
      const subjectsSnapshot = await getDocs(subjectsRef);
      const subjects = new Map(
        subjectsSnapshot.docs
          .filter(doc => subjectIds.has(doc.id))
          .map(doc => [doc.id, doc.data().name])
      );

      // Map the videos to quiz data
      return videosSnapshot.docs.map(doc => {
        const video = doc.data() as Video;
        return {
          ...video.quiz,
          videoId: doc.id,
          videoTitle: video.title,
          subjectName: subjects.get(video.subjectId) || 'Unknown Subject',
          lastAttempt: attempts.get(video.quiz!.id),
        };
      });
    } catch (error) {
      console.error('Error loading quizzes:', error);
      return [];
    }
  };

  const loadNotes = async () => {
    const notesRef = collection(db, `users/${auth.currentUser!.uid}/notes`);
    const notesSnapshot = await getDocs(query(notesRef));
    
    const videoIds = new Set(notesSnapshot.docs.map(doc => doc.data().videoId));
    const videosRef = collection(db, 'videos');
    const videosSnapshot = await getDocs(query(videosRef));
    const videos = new Map(
      videosSnapshot.docs
        .filter(doc => videoIds.has(doc.id))
        .map(doc => [doc.id, { title: doc.data().title, subjectId: doc.data().subjectId }])
    );

    const subjectIds = new Set([...videos.values()].map(v => v.subjectId));
    const subjectsRef = collection(db, 'subjects');
    const subjectsSnapshot = await getDocs(subjectsRef);
    const subjects = new Map(
      subjectsSnapshot.docs
        .filter(doc => subjectIds.has(doc.id))
        .map(doc => [doc.id, doc.data().name])
    );

    return notesSnapshot.docs.map(doc => {
      const note = doc.data();
      const video = videos.get(note.videoId);
      return {
        id: doc.id,
        videoId: note.videoId,
        videoTitle: video?.title || 'Unknown Video',
        subjectName: video ? subjects.get(video.subjectId) || 'Unknown Subject' : 'Unknown Subject',
        content: note.content,
        timestamp: note.timestamp || 0,
        createdAt: note.createdAt?.toDate() || new Date(),
      };
    });
  };

  const loadInsights = async () => {
    const summariesRef = collection(db, `users/${auth.currentUser!.uid}/savedSummaries`);
    const summariesSnapshot = await getDocs(query(summariesRef));
    
    return summariesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        videoId: doc.id,
        summary: data.summary || '',
        confusionPoints: data.confusionPoints || [],
        valuableInsights: data.valuableInsights || [],
        sentiment: data.sentiment || '',
        commentCount: data.commentCount || 0,
        savedAt: data.savedAt?.toDate() || new Date(),
        videoTitle: data.videoTitle,
      };
    });
  };

  const loadReadingResources = async () => {
    if (!auth.currentUser) return [];

    try {
      // Get all videos that have further reading
      const videosRef = collection(db, 'videos');
      const videosSnapshot = await getDocs(
        query(videosRef, where('furtherReading', '!=', null))
      );

      // Get all subject names
      const subjectIds = new Set(videosSnapshot.docs.map(doc => doc.data().subjectId));
      const subjectsRef = collection(db, 'subjects');
      const subjectsSnapshot = await getDocs(subjectsRef);
      const subjects = new Map(
        subjectsSnapshot.docs
          .filter(doc => subjectIds.has(doc.id))
          .map(doc => [doc.id, doc.data().name])
      );

      // Process videos into reading resources
      const readings: ReadingItem[] = [];

      videosSnapshot.docs.forEach(doc => {
        const video = doc.data() as Video;
        
        if (video.furtherReading && video.furtherReading.length > 0) {
          // Add each reading resource
          video.furtherReading.forEach(resource => {
            readings.push({
              videoId: doc.id,
              videoTitle: video.title,
              subjectName: subjects.get(video.subjectId) || 'Unknown Subject',
              resource,
            });
          });
        }
      });

      return readings;
    } catch (error) {
      console.error('Error loading reading resources:', error);
      return [];
    }
  };

  const formatTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${Math.round(hours)}h`;
  };

  const renderProgressBar = (progress: number) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
    </View>
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Reload all data with cache bypass
      await loadInitialData();
      await loadTabData(true);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="#9580FF"
      colors={['#9580FF']}
    />
  );

  const renderOverviewTab = () => (
    <FlatList
      data={activeSubjects}
      ListHeaderComponent={() => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Subjects ({activeSubjects.length})</Text>
        </View>
      )}
      renderItem={({ item: subject }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push(`/subject/${subject.id}`)}
        >
          <View style={styles.rowContent}>
            <View style={styles.rowHeader}>
              <View style={styles.rowLeft}>
                <Ionicons name="school-outline" size={16} color="#666" />
                <Text style={styles.rowTitle}>{subject.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.metaText}>
                {subject.completedVideos} videos watched • {
                  userProgress?.subjects?.[subject.id]?.quizScores ? 
                  new Set(Object.keys(userProgress.subjects[subject.id].quizScores)
                    .map(attemptId => attemptId.split('_')[0])).size : 0
                } quizzes completed
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
      keyExtractor={item => item.id}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No active subjects. Start learning!
          </Text>
          <TouchableOpacity 
            style={styles.browseButton}
            onPress={() => router.push('/(app)/(tabs)/subjects')}
          >
            <Text style={styles.browseButtonText}>Browse Subjects</Text>
          </TouchableOpacity>
        </View>
      }
      refreshControl={refreshControl}
      style={styles.container}
    />
  );

  const renderContent = () => {
    if (!auth.currentUser) {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Please sign in to view your learning progress</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'reading':
        return (
          <FlatList
            data={[1]}
            renderItem={() => (
              <ReadingList 
                readings={cachedData.readings} 
                loading={isLoading}
              />
            )}
            refreshControl={refreshControl}
            style={styles.container}
          />
        );
      case 'insights':
        return (
          <FlatList
            data={[1]}
            renderItem={() => (
              <SavedInsights 
                cachedInsights={cachedData.insights}
                loading={isLoading}
              />
            )}
            refreshControl={refreshControl}
            style={styles.container}
          />
        );
      case 'quizzes':
        return (
          <FlatList
            data={[1]}
            renderItem={() => (
              <QuizList 
                cachedQuizzes={cachedData.quizzes}
                loading={isLoading}
              />
            )}
            refreshControl={refreshControl}
            style={styles.container}
          />
        );
      case 'notes':
        return (
          <FlatList
            data={[1]}
            renderItem={() => (
              <NotesList 
                cachedNotes={cachedData.notes}
                loading={isLoading}
              />
            )}
            refreshControl={refreshControl}
            style={styles.container}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Learning</Text>
      </View>

      <View style={styles.navigation}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navContent}
        >
          {[
            { id: 'overview', icon: 'home-outline', label: 'Overview' },
            { id: 'insights', icon: 'analytics-outline', label: 'Insights' },
            { id: 'reading', icon: 'book-outline', label: 'Reading' },
            { id: 'quizzes', icon: 'school-outline', label: 'Quizzes' },
            { id: 'notes', icon: 'document-text-outline', label: 'Notes' },
          ].map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, activeTab === item.id && styles.activeNavItem]}
              onPress={() => setActiveTab(item.id as Tab)}
            >
              <Ionicons 
                name={item.icon as any} 
                size={18} 
                color={activeTab === item.id ? '#9580FF' : '#999'} 
                style={styles.navIcon}
              />
              <Text style={[
                styles.navLabel,
                activeTab === item.id && styles.activeNavLabel
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  navigation: {
    backgroundColor: '#111',
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  navContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  activeNavItem: {
    backgroundColor: 'rgba(149, 128, 255, 0.15)',
  },
  navIcon: {
    marginRight: 6,
  },
  navLabel: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  activeNavLabel: {
    color: '#9580FF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  subjectsList: {
    gap: 12,
  },
  subjectCard: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 10,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  subjectStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subjectStat: {
    fontSize: 14,
    color: '#9580FF',
    fontWeight: '600',
  },
  placeholder: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    marginBottom: 12,
  },
  browseButton: {
    backgroundColor: '#9580FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#111',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#9580FF',
  },
  streakBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakCount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  streakSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  skeletonCard: {
    opacity: 0.7,
  },
  skeletonTitle: {
    height: 20,
    width: '60%',
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonStat: {
    height: 16,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowContent: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  rowTitle: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
  },
  metaText: {
    color: '#666',
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#222',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
}); 