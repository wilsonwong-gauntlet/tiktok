import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../../services/firebase/index';
import { LearningConcept, RetentionPrompt } from '../../../types/video';
import { getConceptProgress, getConcept } from '../../../services/firebase/learning';

interface ConceptProgress {
  mastery: number;
  nextReview: Date;
  retentionStreak: number;
  reviewHistory: {
    date: Date;
    performance: 'easy' | 'medium' | 'hard';
  }[];
}

export default function ConceptDetail() {
  const { id } = useLocalSearchParams();
  const [concept, setConcept] = useState<LearningConcept | null>(null);
  const [progress, setProgress] = useState<ConceptProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConceptData();
  }, [id]);

  const loadConceptData = async () => {
    if (!auth.currentUser || !id) return;

    try {
      setLoading(true);
      setError(null);

      // Load concept details and progress in parallel
      const [conceptProgress, conceptDetails] = await Promise.all([
        getConceptProgress(auth.currentUser.uid),
        getConcept(id as string),
      ]);

      if (!conceptDetails) {
        setError('Concept not found');
        return;
      }

      setConcept(conceptDetails);

      const relevantProgress = conceptProgress.find(p => p.conceptId === id);
      if (relevantProgress) {
        setProgress({
          mastery: relevantProgress.mastery,
          nextReview: relevantProgress.nextReview,
          retentionStreak: relevantProgress.retentionStreak,
          reviewHistory: relevantProgress.reviewHistory,
        });
      }
    } catch (error) {
      console.error('Error loading concept data:', error);
      setError('Failed to load concept data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = () => {
    // TODO: Navigate to review interface
    console.log('Starting review for concept:', id);
  };

  const renderMasterySection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Mastery Progress</Text>
      <View style={styles.masteryContainer}>
        <View style={styles.masteryCircle}>
          <Text style={styles.masteryText}>{progress?.mastery || 0}%</Text>
        </View>
        <View style={styles.masteryDetails}>
          <Text style={styles.streakText}>
            🔥 {progress?.retentionStreak || 0} day streak
          </Text>
          {progress?.nextReview && (
            <Text style={styles.nextReviewText}>
              Next review: {progress.nextReview.toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderPrerequisites = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Prerequisites</Text>
      {concept?.prerequisites && concept.prerequisites.length > 0 ? (
        concept.prerequisites.map((prereq, index) => (
          <TouchableOpacity 
            key={index}
            style={styles.prerequisiteItem}
            onPress={() => {
              router.navigate(`/concept/${prereq}`);
            }}
          >
            <Text style={styles.prerequisiteText}>{prereq}</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.emptyText}>No prerequisites</Text>
      )}
    </View>
  );

  const renderReviewHistory = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Review History</Text>
      {progress?.reviewHistory && progress.reviewHistory.length > 0 ? (
        progress.reviewHistory.map((review, index) => (
          <View key={index} style={styles.reviewItem}>
            <Text style={styles.reviewDate}>
              {review.date.toLocaleDateString()}
            </Text>
            <View style={[
              styles.performanceBadge,
              styles[`${review.performance}Badge`]
            ]}>
              <Text style={styles.performanceText}>
                {review.performance.charAt(0).toUpperCase() + review.performance.slice(1)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No review history yet</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading concept details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadConceptData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!concept) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Concept not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{concept.name}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>{concept.description}</Text>
        
        {renderMasterySection()}
        {renderPrerequisites()}
        {renderReviewHistory()}

        <TouchableOpacity 
          style={styles.reviewButton}
          onPress={handleStartReview}
        >
          <Text style={styles.reviewButtonText}>Start Review</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  content: {
    padding: 20,
  },
  description: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  masteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masteryCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a472a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  masteryText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  masteryDetails: {
    flex: 1,
  },
  streakText: {
    color: '#FFA000',
    fontSize: 16,
    marginBottom: 8,
  },
  nextReviewText: {
    color: '#666',
    fontSize: 14,
  },
  prerequisiteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  prerequisiteText: {
    color: '#fff',
    fontSize: 16,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reviewDate: {
    color: '#666',
    fontSize: 14,
  },
  performanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  easyBadge: {
    backgroundColor: '#2E7D32',
  },
  mediumBadge: {
    backgroundColor: '#F57F17',
  },
  hardBadge: {
    backgroundColor: '#B71C1C',
  },
  performanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  reviewButton: {
    backgroundColor: '#1a472a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  retryButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 