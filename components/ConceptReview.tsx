import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { RetentionPrompt, LearningConcept } from '../types/video';
import { updateReviewProgress } from '../services/firebase/learning';
import { auth } from '../services/firebase/index';

interface ConceptReviewProps {
  concept: LearningConcept;
  prompt: RetentionPrompt;
  onComplete: () => void;
  onClose: () => void;
}

export default function ConceptReview({
  concept,
  prompt,
  onComplete,
  onClose,
}: ConceptReviewProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePerformanceRating = async (performance: 'easy' | 'medium' | 'hard') => {
    if (!auth.currentUser) return;
    
    try {
      setSubmitting(true);
      await updateReviewProgress(auth.currentUser.uid, concept.id, performance);
      onComplete();
    } catch (error) {
      console.error('Error updating review progress:', error);
      // TODO: Show error feedback
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.conceptName}>{concept.name}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.promptCard}>
          <Text style={styles.promptText}>{prompt.prompt}</Text>
          
          {!showAnswer && (
            <TouchableOpacity 
              style={styles.showAnswerButton}
              onPress={() => setShowAnswer(true)}
            >
              <Text style={styles.showAnswerText}>Show Answer</Text>
            </TouchableOpacity>
          )}

          {showAnswer && (
            <View style={styles.answerSection}>
              <Text style={styles.answerTitle}>How well did you remember this?</Text>
              
              <View style={styles.ratingButtons}>
                <TouchableOpacity 
                  style={[styles.ratingButton, styles.hardButton]}
                  onPress={() => handlePerformanceRating('hard')}
                  disabled={submitting}
                >
                  <Text style={styles.ratingButtonText}>Hard</Text>
                  <Text style={styles.ratingDescription}>
                    Struggled to recall
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.ratingButton, styles.mediumButton]}
                  onPress={() => handlePerformanceRating('medium')}
                  disabled={submitting}
                >
                  <Text style={styles.ratingButtonText}>Medium</Text>
                  <Text style={styles.ratingDescription}>
                    Recalled with effort
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.ratingButton, styles.easyButton]}
                  onPress={() => handlePerformanceRating('easy')}
                  disabled={submitting}
                >
                  <Text style={styles.ratingButtonText}>Easy</Text>
                  <Text style={styles.ratingDescription}>
                    Recalled easily
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  conceptName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  promptCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  promptText: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 20,
  },
  showAnswerButton: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  showAnswerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  answerSection: {
    marginTop: 20,
  },
  answerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  ratingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  ratingButton: {
    flex: 1,
    margin: 4,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  hardButton: {
    backgroundColor: '#B71C1C',
  },
  mediumButton: {
    backgroundColor: '#F57F17',
  },
  easyButton: {
    backgroundColor: '#2E7D32',
  },
  ratingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
}); 