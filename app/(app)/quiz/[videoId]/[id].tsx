import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../../../services/firebase';
import { Quiz, QuizAttempt } from '../../../../types/video';
import { VideoService } from '../../../../services/firebase/video';
import { SubjectService } from '../../../../services/firebase/subjects';
import { getLastQuizAttempt } from '../../../../services/firebase/learning';

interface QuizDetails extends Quiz {
  videoTitle: string;
  subjectName: string;
  lastAttempt?: QuizAttempt;
}

export default function QuizDetailsScreen() {
  const { id, videoId } = useLocalSearchParams();
  const [quiz, setQuiz] = useState<QuizDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuiz();
  }, [id, videoId]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const video = await VideoService.fetchVideoById(videoId as string);
      
      if (video?.quiz) {
        const subject = await SubjectService.getSubjectById(video.subjectId, auth.currentUser?.uid || '');
        const lastAttempt = auth.currentUser ? 
          await getLastQuizAttempt(auth.currentUser.uid, video.quiz.id) : 
          undefined;

        setQuiz({
          ...video.quiz,
          videoTitle: video.title,
          subjectName: subject?.name || 'General',
          lastAttempt,
        });
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Quiz Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading quiz...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!quiz) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Quiz Details</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Quiz not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Quiz Details</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.quizHeader}>
          <Text style={styles.quizTitle}>{quiz.questions.length} Questions Quiz</Text>
          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="school-outline" size={16} color="#666" />
              <Text style={styles.tagText}>{quiz.subjectName}</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="play-circle-outline" size={16} color="#666" />
              <Text style={styles.tagText}>From {quiz.videoTitle}</Text>
            </View>
          </View>
        </View>

        {quiz.lastAttempt && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Attempt</Text>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text style={[
                styles.scoreValue,
                { color: quiz.lastAttempt.score >= 70 ? '#6B21A8' : '#ff4444' }
              ]}>
                {Math.round(quiz.lastAttempt.score)}%
              </Text>
              <Text style={styles.attemptDate}>
                {new Date(quiz.lastAttempt.completedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions Preview</Text>
          {quiz.questions.map((question, index) => (
            <View key={index} style={styles.questionPreview}>
              <Text style={styles.questionNumber}>Question {index + 1}</Text>
              <Text style={styles.questionText} numberOfLines={2}>
                {question.question}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.startButton}
          onPress={() => router.push(`/video/${videoId}?highlight=quiz`)}
        >
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.startButtonText}>
            {quiz.lastAttempt ? 'Retry Quiz' : 'Start Quiz'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    padding: 16,
  },
  quizHeader: {
    marginBottom: 24,
  },
  quizTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    color: '#666',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  scoreCard: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  attemptDate: {
    color: '#666',
    fontSize: 12,
  },
  questionPreview: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  questionNumber: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  questionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a472a',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 32,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4444',
  },
}); 