import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Subject } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { auth } from '../../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

interface UserProgress {
  userId: string;
  subjects: {
    [subjectId: string]: {
      progress: number;
      lastActivity: Date;
      completedVideos: string[];
      masteredConcepts: string[];
      quizScores: {
        [quizId: string]: number;
      };
      reflections: string[];
    }
  };
  learningStreak: number;
  totalStudyTime: number;
  weeklyGoals: {
    target: number;
    achieved: number;
  };
}

export default function LearningScreen() {
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [activeSubjects, setActiveSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProgress();
  }, []);

  const loadUserProgress = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const progressRef = doc(db, 'userProgress', auth.currentUser.uid);
      const progressDoc = await getDoc(progressRef);
      
      if (progressDoc.exists()) {
        const progress = progressDoc.data() as UserProgress;
        setUserProgress(progress);

        // Load active subjects
        const subjects = await Promise.all(
          Object.keys(progress.subjects).map(id => 
            SubjectService.getSubjectById(id, auth.currentUser!.uid)
          )
        );
        setActiveSubjects(subjects.filter(Boolean) as Subject[]);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = (progress: number) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
    </View>
  );

  const formatTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${Math.round(hours)}h`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>My Learning</Text>
          <Text style={styles.subtitle}>Track your progress</Text>
        </View>

        <View style={styles.overview}>
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Weekly Goal</Text>
            <View style={styles.goalProgress}>
              <Text style={styles.statsValue}>
                {formatTime(userProgress?.weeklyGoals.achieved || 0)}/
                {formatTime(userProgress?.weeklyGoals.target || 10)}
              </Text>
              {renderProgressBar((userProgress?.weeklyGoals.achieved || 0) / 
                (userProgress?.weeklyGoals.target || 10) * 100)}
            </View>
          </View>
          
          <View style={styles.streakCard}>
            <Text style={styles.streakTitle}>Learning Streak</Text>
            <Text style={styles.streakValue}>
              🔥 {userProgress?.learningStreak || 0} days
            </Text>
          </View>
        </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  overview: {
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'space-between',
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 10,
    marginRight: 5,
  },
  streakCard: {
    flex: 1,
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 10,
    marginLeft: 5,
  },
  statsTitle: {
    color: '#666',
    fontSize: 14,
  },
  statsValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
  },
  streakTitle: {
    color: '#666',
    fontSize: 14,
  },
  streakValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
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
  goalProgress: {
    marginTop: 8,
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
}); 