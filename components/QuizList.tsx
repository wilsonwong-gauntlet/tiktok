import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../services/firebase/index';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Quiz, QuizAttempt } from '../types/video';

interface QuizWithMeta extends Quiz {
  subjectName: string;
  videoTitle: string;
  lastAttempt?: QuizAttempt;
}

interface QuizListProps {
  cachedQuizzes?: QuizWithMeta[];
  onDataLoaded?: (quizzes: QuizWithMeta[]) => void;
}

export default function QuizList({ cachedQuizzes, onDataLoaded }: QuizListProps) {
  const [quizzes, setQuizzes] = useState<QuizWithMeta[]>(cachedQuizzes || []);
  const [loading, setLoading] = useState(!cachedQuizzes);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!cachedQuizzes) {
      loadQuizzes();
    }
  }, []);

  const loadQuizzes = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // Get all videos with quizzes
      const videosRef = collection(db, 'videos');
      const videosSnapshot = await getDocs(query(videosRef, where('quiz', '!=', null)));
      
      // Get all quiz attempts by the user
      const attemptsRef = collection(db, 'quizAttempts');
      const attemptsSnapshot = await getDocs(
        query(attemptsRef, where('userId', '==', auth.currentUser.uid))
      );
      const attempts = new Map(
        attemptsSnapshot.docs.map(doc => [doc.data().quizId, doc.data() as QuizAttempt])
      );

      // Get subject names
      const subjectsRef = collection(db, 'subjects');
      const subjectsSnapshot = await getDocs(subjectsRef);
      const subjects = new Map(
        subjectsSnapshot.docs.map(doc => [doc.id, doc.data().name])
      );

      // Combine all data
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

      const sortedQuizzes = quizzesData.sort((a, b) => {
        // Sort by completion and then by subject name
        const aComplete = !!a.lastAttempt;
        const bComplete = !!b.lastAttempt;
        if (aComplete !== bComplete) return aComplete ? 1 : -1;
        return a.subjectName.localeCompare(b.subjectName);
      });

      setQuizzes(sortedQuizzes);
      onDataLoaded?.(sortedQuizzes);
    } catch (error) {
      console.error('Error loading quizzes:', error);
      setError('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
    setIsSelectionMode(newSelection.size > 0);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === quizzes.length) {
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedItems(new Set(quizzes.map(quiz => quiz.id)));
    }
  };

  const handleBulkShare = async () => {
    if (selectedItems.size === 0) return;

    const selectedQuizzes = quizzes.filter(quiz => 
      selectedItems.has(quiz.id)
    );

    const quizText = selectedQuizzes.map(quiz => [
      `📝 Quiz from ${quiz.videoTitle}`,
      `Subject: ${quiz.subjectName}`,
      '',
      quiz.lastAttempt ? 
        `Your Score: ${Math.round(quiz.lastAttempt.score * 100)}%` : 
        'Not attempted yet',
      '',
      'Questions:',
      ...quiz.questions.map((q, i) => [
        `${i + 1}. ${q.question}`,
        ...q.options.map((opt, j) => `   ${String.fromCharCode(65 + j)}. ${opt}`),
        quiz.lastAttempt ? 
          `Your answer: ${String.fromCharCode(65 + quiz.lastAttempt.answers[i])}` : 
          'Not answered',
        `Correct answer: ${String.fromCharCode(65 + q.correctOptionIndex)}`,
        `Explanation: ${q.explanation}`,
        ''
      ].join('\n')),
      '-------------------',
    ].join('\n')).join('\n\n');

    try {
      await Share.share({
        message: quizText,
      });
    } catch (error) {
      console.error('Error sharing quizzes:', error);
    }
  };

  const renderQuizRow = ({ item }: { item: QuizWithMeta }) => (
    <TouchableOpacity
      style={[
        styles.row,
        selectedItems.has(item.id) && styles.selectedRow
      ]}
      onLongPress={() => {
        setIsSelectionMode(true);
        toggleSelection(item.id);
      }}
      onPress={() => {
        if (isSelectionMode) {
          toggleSelection(item.id);
        } else {
          router.push(`/video/${item.videoId}?highlight=quiz`);
        }
      }}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            {isSelectionMode && (
              <Ionicons 
                name={selectedItems.has(item.id) ? "checkbox" : "square-outline"} 
                size={20} 
                color={selectedItems.has(item.id) ? "#1a472a" : "#666"}
                style={styles.checkbox}
              />
            )}
            <Ionicons 
              name={item.lastAttempt ? "checkmark-circle" : "school-outline"} 
              size={16} 
              color={item.lastAttempt ? "#4CAF50" : "#666"} 
            />
            <View style={styles.textContent}>
              <Text style={styles.title} numberOfLines={1}>
                {item.questions.length} Questions Quiz
              </Text>
              {item.lastAttempt && (
                <Text style={[
                  styles.score,
                  { color: item.lastAttempt.score >= 0.7 ? '#4CAF50' : '#ff4444' }
                ]}>
                  Score: {Math.round(item.lastAttempt.score * 100)}%
                </Text>
              )}
            </View>
          </View>
          {!isSelectionMode && (
            <Ionicons name="chevron-forward" size={16} color="#666" />
          )}
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {item.subjectName} • From {item.videoTitle}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => {
    if (!isSelectionMode || quizzes.length === 0) return null;

    return (
      <View style={styles.selectionHeader}>
        <TouchableOpacity 
          style={styles.selectionButton} 
          onPress={toggleSelectAll}
        >
          <Ionicons 
            name={selectedItems.size === quizzes.length ? "checkbox" : "square-outline"} 
            size={20} 
            color="#666" 
          />
          <Text style={styles.selectionButtonText}>
            {selectedItems.size === quizzes.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
        <View style={styles.selectionActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleBulkShare}
          >
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={quizzes}
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
  selectedRow: {
    backgroundColor: 'rgba(26, 71, 42, 0.2)',
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
  checkbox: {
    marginRight: 4,
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
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    padding: 16,
    textAlign: 'center',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionButtonText: {
    color: '#666',
    fontSize: 14,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
}); 