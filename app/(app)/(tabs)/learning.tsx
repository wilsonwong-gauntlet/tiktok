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
  const [loading, setLoading] = useState(true);
  const [cachedData, setCachedData] = useState<CachedData>({
    readings: {},
    quizzes: [],
    notes: [],
    insights: [],
    lastFetched: {},
  });

  useEffect(() => {
    loadUserData();
  }, []);

  // Add a refresh function that can be called from other components
  const refreshLearningData = useCallback(() => {
    console.log('Refreshing learning data...');
    loadUserData();
  }, []);

  // Export the refresh function to make it available to other components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).refreshLearningData = refreshLearningData;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).refreshLearningData;
      }
    };
  }, [refreshLearningData]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const loadTabData = async () => {
      if (!auth.currentUser) return; // Double-check auth status before async operations
      
      switch (activeTab) {
        case 'reading':
          if (shouldFetchData('readings')) {
            await loadReadingResources();
          }
          break;
        case 'quizzes':
          if (shouldFetchData('quizzes')) {
            try {
              setLoading(true);
              const videosRef = collection(db, 'videos');
              const videosSnapshot = await getDocs(query(videosRef, where('quiz', '!=', null)));
              
              const attemptsRef = collection(db, 'quizAttempts');
              const attemptsSnapshot = await getDocs(
                query(attemptsRef, where('userId', '==', auth.currentUser.uid))
              );
              const attempts = new Map(
                attemptsSnapshot.docs.map(doc => [doc.data().quizId, doc.data() as QuizAttempt])
              );

              const subjectsRef = collection(db, 'subjects');
              const subjectsSnapshot = await getDocs(subjectsRef);
              const subjects = new Map(
                subjectsSnapshot.docs.map(doc => [doc.id, doc.data().name])
              );

              const quizzesData = videosSnapshot.docs.map(doc => {
                const video = doc.data();
                return {
                  ...video.quiz,
                  videoId: doc.id,
                  videoTitle: video.title,
                  subjectName: subjects.get(video.subjectId) || 'Unknown Subject',
                  lastAttempt: attempts.get(video.quiz.id),
                };
              });

              updateCache('quizzes', quizzesData);
            } catch (error) {
              console.error('Error loading quizzes:', error);
            } finally {
              setLoading(false);
            }
          }
          break;
        case 'notes':
          if (shouldFetchData('notes')) {
            try {
              setLoading(true);
              const notesRef = collection(db, `users/${auth.currentUser.uid}/notes`);
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

              const notesData = notesSnapshot.docs.map(doc => {
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

              updateCache('notes', notesData);
            } catch (error) {
              console.error('Error loading notes:', error);
            } finally {
              setLoading(false);
            }
          }
          break;
        case 'insights':
          if (shouldFetchData('insights')) {
            try {
              setLoading(true);
              const summariesRef = collection(db, `users/${auth.currentUser.uid}/savedSummaries`);
              const summariesSnapshot = await getDocs(query(summariesRef));
              
              const summaries = summariesSnapshot.docs.map(doc => ({
                videoId: doc.id,
                ...doc.data(),
                savedAt: doc.data().savedAt?.toDate() || new Date(),
              }));

              updateCache('insights', summaries);
            } catch (error) {
              console.error('Error loading insights:', error);
            } finally {
              setLoading(false);
            }
          }
          break;
      }
    };

    loadTabData();
  }, [activeTab]);

  const shouldFetchData = (dataType: keyof CachedData['lastFetched']): boolean => {
    const lastFetched = cachedData.lastFetched[dataType];
    if (!lastFetched) return true;
    return Date.now() - lastFetched > CACHE_DURATION;
  };

  const updateCache = (
    dataType: 'readings' | 'quizzes' | 'notes' | 'insights',
    data: any
  ) => {
    setCachedData(prev => ({
      ...prev,
      [dataType]: data,
      lastFetched: {
        ...prev.lastFetched,
        [dataType]: Date.now(),
      },
    }));
  };

  const loadUserData = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const [progressData, subjects] = await Promise.all([
        SubjectService.getUserProgress(auth.currentUser.uid),
        SubjectService.getActiveSubjects(auth.currentUser.uid),
      ]);

      setUserProgress(progressData);
      setActiveSubjects(subjects);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReadingResources = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const allSubjects = await SubjectService.getAllSubjects();
      const readingsBySubject: CachedData['readings'] = {};

      for (const subject of allSubjects) {
        const videos = await VideoService.getVideosBySubject(subject.id);
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

      updateCache('readings', readingsBySubject);
    } catch (error) {
      console.error('Error loading reading resources:', error);
    } finally {
      setLoading(false);
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
        {activeSubjects.length > 0 ? (
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
          />
        );
      case 'insights':
        return (
          <SavedInsights 
            cachedInsights={cachedData.insights}
            onDataLoaded={(insights) => updateCache('insights', insights)}
          />
        );
      case 'quizzes':
        return (
          <QuizList 
            cachedQuizzes={cachedData.quizzes}
            onDataLoaded={(quizzes) => updateCache('quizzes', quizzes)}
          />
        );
      case 'notes':
        return (
          <NotesList 
            cachedNotes={cachedData.notes}
            onDataLoaded={(notes) => updateCache('notes', notes)}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a472a" />
      </View>
    );
  }

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

      {renderContent()}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
}); 