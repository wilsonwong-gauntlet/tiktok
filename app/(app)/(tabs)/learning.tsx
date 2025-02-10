import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Subject, UserProgress, FurtherReading, Quiz, QuizAttempt, Note, QuizQuestion } from '../../../types/video';
import { auth, db } from '../../../services/firebase';
import { VideoService } from '../../../services/firebase/video';
import { SubjectService } from '../../../services/firebase/subjects';
import ReadingList from '../../../components/ReadingList';
import SavedInsights from '../../../components/SavedInsights';
import QuizList from '../../../components/QuizList';
import NotesList from '../../../components/NotesList';
import { collection, getDocs, query, where } from 'firebase/firestore';

type Tab = 'overview' | 'reading' | 'quizzes' | 'notes' | 'insights';

interface CachedData {
  readings: {
    [subjectId: string]: {
      subjectName: string;
      resources: {
        videoId: string;
        videoTitle: string;
        resource: FurtherReading;
      }[];
    };
  };
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
  const [isLoading, setIsLoading] = useState(true);
  const [cachedData, setCachedData] = useState<CachedData>({
    readings: {},
    quizzes: [],
    notes: [],
    insights: [],
    lastFetched: {},
  });

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
      const [progressData, subjects] = await Promise.all([
        SubjectService.getUserProgress(auth.currentUser!.uid),
        SubjectService.getActiveSubjects(auth.currentUser!.uid),
      ]);

      setUserProgress(progressData);
      setActiveSubjects(subjects);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTabData = async () => {
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
    const isCacheValid = lastFetched && (Date.now() - lastFetched) < CACHE_DURATION;
    
    if (isCacheValid) {
      console.log('Using cached data for', activeTab);
      return;
    }

    // Check for existing data to avoid loading state
    const hasExistingData = activeTab === 'reading' 
      ? Object.keys(cachedData.readings).length > 0
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
    const videosRef = collection(db, 'videos');
    const videosSnapshot = await getDocs(query(videosRef, where('quiz', '!=', null)));
    
    const attemptsRef = collection(db, 'quizAttempts');
    const attemptsSnapshot = await getDocs(
      query(attemptsRef, where('userId', '==', auth.currentUser!.uid))
    );

    const attempts = new Map(
      attemptsSnapshot.docs.map(doc => [doc.data().quizId, doc.data() as QuizAttempt])
    );

    const subjectsRef = collection(db, 'subjects');
    const subjectsSnapshot = await getDocs(subjectsRef);
    const subjects = new Map(
      subjectsSnapshot.docs.map(doc => [doc.id, doc.data().name])
    );

    return videosSnapshot.docs.map(doc => {
      const video = doc.data();
      return {
        ...video.quiz,
        videoId: doc.id,
        videoTitle: video.title,
        subjectName: subjects.get(video.subjectId) || 'Unknown Subject',
        lastAttempt: attempts.get(video.quiz.id),
      };
    });
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
    if (!auth.currentUser) return;

    try {
      const allSubjects = await SubjectService.getAllSubjects();
      const readingsBySubject: CachedData['readings'] = {};

      // Load all videos in parallel
      const subjectsWithVideos = await Promise.all(
        allSubjects.map(async subject => ({
          subject,
          videos: await VideoService.getVideosBySubject(subject.id)
        }))
      );

      // Process the results
      for (const { subject, videos } of subjectsWithVideos) {
        const subjectResources = videos
          .filter(video => video.furtherReading && video.furtherReading.length > 0)
          .flatMap(video => 
            video.furtherReading!.map(resource => ({
              videoId: video.id,
              videoTitle: video.title,
              resource,
            }))
          );

        if (subjectResources.length > 0) {
          readingsBySubject[subject.id] = {
            subjectName: subject.name,
            resources: subjectResources,
          };
        }
      }

      return readingsBySubject;
    } catch (error) {
      console.error('Error loading reading resources:', error);
      return {};
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

  const renderTab = (tab: Tab, label: string, icon: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <View style={styles.tabContent}>
        <Ionicons 
          name={icon as any} 
          size={20} 
          color={activeTab === tab ? '#fff' : '#666'} 
        />
        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
          {label}
        </Text>
      </View>
      {activeTab === tab && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );

  const renderOverviewTab = () => (
    <ScrollView style={styles.scrollView}>
      <TouchableOpacity style={styles.streakBanner}>
        <View style={styles.streakContent}>
          <Ionicons name="flame" size={28} color="#ff9500" />
          <View>
            <Text style={styles.streakCount}>
              {userProgress?.streak?.currentStreak || 0} day streak!
            </Text>
            {(userProgress?.streak?.currentStreak || 0) >= 7 && (
              <Text style={styles.streakSubtext}>You're on fire! 🔥</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Subjects</Text>
        {isLoading ? (
          <View style={styles.subjectsList}>
            {[1, 2, 3].map((_, index) => (
              <View key={index} style={[styles.subjectCard, styles.skeletonCard]}>
                <View style={styles.skeletonTitle} />
                <View style={styles.subjectStats}>
                  <View style={[styles.skeletonStat, { width: 80 }]} />
                  <View style={[styles.skeletonStat, { width: 60 }]} />
                </View>
              </View>
            ))}
          </View>
        ) : activeSubjects.length > 0 ? (
          <View style={styles.subjectsList}>
            {activeSubjects.map(subject => (
              <TouchableOpacity
                key={subject.id}
                style={styles.subjectCard}
                onPress={() => router.push(`/subject/${subject.id}`)}
              >
                <View style={styles.subjectHeader}>
                  <Text style={styles.subjectTitle}>{subject.name}</Text>
                </View>
                <View style={styles.subjectStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="play-circle" size={16} color="#1a472a" />
                    <Text style={styles.subjectStat}>
                      {subject.completedVideos} videos
                    </Text>
                  </View>
                  {userProgress?.subjects[subject.id]?.quizScores && (
                    <View style={styles.statItem}>
                      <Ionicons name="school" size={16} color="#1a472a" />
                      <Text style={styles.subjectStat}>
                        {Object.keys(userProgress.subjects[subject.id].quizScores).length} quizzes
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              No active subjects. Start learning!
            </Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => router.push('/(app)/(tabs)/subjects')}
            >
              <Text style={styles.browseButtonText}>Browse Subjects</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
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
          <ReadingList 
            readings={cachedData.readings} 
            onResourcePress={(videoId, resource) => {
              router.push(`/video/${videoId}?highlight=reading`);
            }}
            loading={isLoading}
          />
        );
      case 'insights':
        return (
          <SavedInsights 
            cachedInsights={cachedData.insights}
            loading={isLoading}
          />
        );
      case 'quizzes':
        return (
          <QuizList 
            cachedQuizzes={cachedData.quizzes}
            loading={isLoading}
          />
        );
      case 'notes':
        return (
          <NotesList 
            cachedNotes={cachedData.notes}
            loading={isLoading}
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

      <View style={styles.tabBar}>
        {renderTab('overview', 'Overview', 'home-outline')}
        {renderTab('insights', 'Insights', 'analytics-outline')}
        {renderTab('reading', 'Reading', 'book-outline')}
        {renderTab('quizzes', 'Quizzes', 'school-outline')}
        {renderTab('notes', 'Notes', 'document-text-outline')}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    position: 'relative',
  },
  tabContent: {
    alignItems: 'center',
    gap: 4,
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#1a472a',
  },
  tabText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
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
    color: '#1a472a',
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
    backgroundColor: '#1a472a',
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
    backgroundColor: '#1a472a',
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
}); 