import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QuizAttempt, QuizQuestion } from '../types/video';
import { useRouter } from 'expo-router';

interface CachedQuiz {
  id: string;
  videoId: string;
  videoTitle: string;
  subjectName: string;
  questions: QuizQuestion[];
  lastAttempt?: QuizAttempt;
}

interface QuizListProps {
  cachedQuizzes: CachedQuiz[];
  loading?: boolean;
}

export default function QuizList({ cachedQuizzes = [], loading = false }: QuizListProps) {
  const router = useRouter();

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        {[1, 2, 3].map((_, index) => (
          <View key={index} style={[styles.quizCard, styles.skeletonCard]}>
            <View style={[styles.skeletonText, { width: '70%', marginBottom: 12 }]} />
            <View style={[styles.skeletonText, { width: '40%', marginBottom: 16 }]} />
            <View style={styles.quizMeta}>
              <View style={[styles.skeletonText, { width: 80 }]} />
              <View style={[styles.skeletonText, { width: 60 }]} />
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  const renderQuizRow = ({ item: quiz }: { item: CachedQuiz }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/quiz/${quiz.videoId}/${quiz.id}`)}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            <Ionicons 
              name={quiz.lastAttempt ? "checkmark-circle" : "school-outline"} 
              size={16} 
              color={quiz.lastAttempt ? "#4CAF50" : "#666"} 
            />
            <View style={styles.textContent}>
              <Text style={styles.title} numberOfLines={1}>
                {quiz.questions?.length || 0} Questions Quiz
              </Text>
              {quiz.lastAttempt && (
                <Text style={[
                  styles.score,
                  { color: quiz.lastAttempt.score >= 70 ? '#4CAF50' : '#ff4444' }
                ]}>
                  Score: {Math.round(quiz.lastAttempt.score)}%
                </Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {quiz.subjectName} • From {quiz.videoTitle}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={cachedQuizzes}
        renderItem={renderQuizRow}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No quizzes available</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
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
  textContent: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  score: {
    fontSize: 12,
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
  quizCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 4,
    marginBottom: 16,
  },
  skeletonCard: {
    opacity: 0.7,
  },
  skeletonText: {
    backgroundColor: '#333',
    borderRadius: 4,
    height: 16,
  },
  quizMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}); 