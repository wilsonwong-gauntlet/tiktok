import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Subject, UserProgress, FurtherReading } from '../../../types/video';
import { auth } from '../../../services/firebase';
import { VideoService } from '../../../services/firebase/video';
import { SubjectService } from '../../../services/firebase/subjects';
import ReadingList from '../../../components/ReadingList';
import SavedInsights from '../../../components/SavedInsights';
import QuizList from '../../../components/QuizList';
import NotesList from '../../../components/NotesList';

type Tab = 'overview' | 'reading' | 'quizzes' | 'notes' | 'insights';

export default function LearningScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [activeSubjects, setActiveSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<{
    [subjectId: string]: {
      subjectName: string;
      resources: {
        videoId: string;
        videoTitle: string;
        resource: FurtherReading;
      }[];
    };
  }>({});

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (activeTab === 'reading' && Object.keys(readings).length === 0) {
      loadReadingResources();
    }
  }, [activeTab]);

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
      const readingsBySubject: typeof readings = {};

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

      setReadings(readingsBySubject);
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
                  <Text style={styles.subjectProgress}>
                    {subject.progress}%
                  </Text>
                </View>
                {renderProgressBar(subject.progress)}
                <View style={styles.subjectStats}>
                  <Text style={styles.subjectStat}>
                    {subject.completedVideos}/{subject.videosCount} videos
                  </Text>
                  <Text style={styles.subjectStat}>
                    {subject.concepts.filter(c => c.status === 'mastered').length} concepts mastered
                  </Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          {userProgress && Object.entries(userProgress.subjects).map(([subjectId, data]) => {
            const subject = activeSubjects.find(s => s.id === subjectId);
            if (!subject) return null;

            return (
              <TouchableOpacity 
                key={subjectId}
                style={styles.activityCard}
                onPress={() => router.push(`/subject/${subjectId}`)}
              >
                <View style={styles.activityIcon}>
                  <Ionicons name="play-circle" size={24} color="#1a472a" />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>
                    Watched video in {subject.name}
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(data.lastActivity).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            );
          })}
        </View>
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
        return <ReadingList readings={readings} onResourcePress={(videoId, resource) => {
          router.push(`/video/${videoId}?highlight=reading`);
        }} />;
      case 'insights':
        return <SavedInsights />;
      case 'quizzes':
        return <QuizList />;
      case 'notes':
        return <NotesList />;
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
  subjectProgress: {
    fontSize: 14,
    color: '#1a472a',
    fontWeight: '600',
  },
  subjectStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  subjectStat: {
    fontSize: 12,
    color: '#666',
  },
  activityList: {
    gap: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 10,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 71, 42, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
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
  comingSoon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  comingSoonText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
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
}); 