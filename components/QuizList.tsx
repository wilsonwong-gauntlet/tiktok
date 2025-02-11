import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../services/firebase/index';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Quiz, QuizAttempt, QuizQuestion } from '../types/video';
import { Video, Subject } from '../types/video';
import { getLastQuizAttempt } from '../services/firebase/learning';
import QuizPanel from './QuizPanel';

interface QuizWithMeta extends Quiz {
  subjectName: string;
  videoTitle: string;
  lastAttempt?: QuizAttempt;
}

interface QuizListProps {
  videos: Video[];
  subject: Subject;
}

export default function QuizList({ videos, subject }: QuizListProps) {
  const router = useRouter();
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<{[key: string]: QuizAttempt | null}>({});

  useEffect(() => {
    if (auth.currentUser) {
      loadQuizAttempts();
    }
  }, []);

  const loadQuizAttempts = async () => {
    const attempts: {[key: string]: QuizAttempt | null} = {};
    
    for (const video of videos) {
      if (video.quiz) {
        const attempt = await getLastQuizAttempt(auth.currentUser!.uid, video.quiz.id);
        attempts[video.id] = attempt || null;
      }
    }
    
    setQuizAttempts(attempts);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFC107';
    return '#f44336';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const videosWithQuizzes = videos.filter(video => video.quiz);

  return (
    <ScrollView style={styles.container}>
      {videosWithQuizzes.map(video => (
        <View key={video.id} style={styles.quizCard}>
          <TouchableOpacity
            style={styles.quizHeader}
            onPress={() => setExpandedVideoId(
              expandedVideoId === video.id ? null : video.id
            )}
          >
            <View style={styles.headerContent}>
              <Text style={styles.videoTitle}>{video.title}</Text>
              <View style={styles.quizMeta}>
                <Text style={styles.questionCount}>
                  {video.quiz?.questions.length} questions
                </Text>
                {quizAttempts[video.id] && (
                  <Text style={[
                    styles.score,
                    { color: getScoreColor(quizAttempts[video.id]!.score) }
                  ]}>
                    • Last attempt: {formatDate(quizAttempts[video.id]!.completedAt)} 
                    ({Math.round(quizAttempts[video.id]!.score)}%)
                  </Text>
                )}
              </View>
            </View>
            <Ionicons
              name={expandedVideoId === video.id ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          {expandedVideoId === video.id && video.quiz && (
            <View style={styles.quizContent}>
              <QuizPanel
                quiz={video.quiz}
                videoId={video.id}
                subjectId={subject.id}
                onComplete={async (score) => {
                  if (auth.currentUser) {
                    setQuizAttempts(prev => ({
                      ...prev,
                      [video.id]: {
                        id: `${video.quiz!.id}_${Date.now()}`,
                        userId: auth.currentUser!.uid,
                        quizId: video.quiz!.id,
                        score,
                        completedAt: new Date(),
                        answers: []
                      }
                    }));
                  }
                }}
              />
            </View>
          )}
        </View>
      ))}

      {videosWithQuizzes.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#666" />
          <Text style={styles.emptyTitle}>No Quizzes Yet</Text>
          <Text style={styles.emptyText}>
            Start watching videos to unlock quizzes and test your knowledge
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  quizCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  headerContent: {
    flex: 1,
    marginRight: 16,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  quizMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionCount: {
    fontSize: 14,
    color: '#666',
  },
  score: {
    fontSize: 14,
    marginLeft: 4,
  },
  quizContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
}); 