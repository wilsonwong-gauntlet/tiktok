import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LearningConcept, RetentionPrompt } from '../types/video';
import { auth } from '../services/firebase/index';
import { getConceptProgress, getDueReviews, initializeSampleData } from '../services/firebase/learning';

interface ConceptProgress {
  concept: LearningConcept;
  mastery: number; // 0-100
  nextReview: Date | null;
  retentionStreak: number;
}

interface LearningDashboardProps {
  onConceptSelect: (concept: LearningConcept) => void;
}

export default function LearningDashboard({ onConceptSelect }: LearningDashboardProps) {
  const [conceptProgress, setConceptProgress] = useState<ConceptProgress[]>([]);
  const [dueReviews, setDueReviews] = useState<RetentionPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.currentUser) {
      loadData();
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        loadProgress(),
        loadDueReviews()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load learning progress. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!auth.currentUser) return;
    
    try {
      const progress = await getConceptProgress(auth.currentUser.uid);
      // Transform LearningProgress into ConceptProgress format
      const transformedProgress: ConceptProgress[] = progress.map(p => ({
        concept: {
          id: p.conceptId,
          name: p.conceptId, // TODO: Fetch concept details from a separate call
          description: '',
          prerequisites: [],
          retentionPrompts: [],
          transferTasks: [],
        },
        mastery: p.mastery,
        nextReview: p.nextReview,
        retentionStreak: p.retentionStreak,
      }));
      setConceptProgress(transformedProgress);
    } catch (error) {
      console.error('Error loading progress:', error);
      throw error;
    }
  };

  const loadDueReviews = async () => {
    if (!auth.currentUser) return;
    
    try {
      const reviews = await getDueReviews(auth.currentUser.uid);
      setDueReviews(reviews);
    } catch (error) {
      console.error('Error loading due reviews:', error);
      throw error;
    }
  };

  const handleInitializeSampleData = async () => {
    if (!auth.currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      await initializeSampleData(auth.currentUser.uid);
      await loadData();
    } catch (error) {
      console.error('Error initializing sample data:', error);
      setError('Failed to initialize sample data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your learning progress...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderMasteryBar = (mastery: number) => (
    <View style={styles.masteryBarContainer}>
      <View style={[styles.masteryBar, { width: `${mastery}%` }]} />
    </View>
  );

  const renderDueReviews = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Due for Review</Text>
      {dueReviews.length === 0 ? (
        <Text style={styles.emptyText}>No reviews due</Text>
      ) : (
        dueReviews.map((review, index) => (
          <TouchableOpacity 
            key={index}
            style={styles.reviewItem}
            onPress={() => {/* TODO: Handle review */}}
          >
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>{review.prompt}</Text>
              <Text style={styles.reviewDue}>Due Now</Text>
            </View>
            <Text style={styles.reviewDifficulty}>
              Difficulty: {review.difficulty}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderConceptProgress = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Concept Mastery</Text>
      {conceptProgress.map((progress, index) => (
        <TouchableOpacity 
          key={index}
          style={styles.conceptItem}
          onPress={() => onConceptSelect(progress.concept)}
        >
          <Text style={styles.conceptName}>{progress.concept.name}</Text>
          {renderMasteryBar(progress.mastery)}
          {progress.nextReview && (
            <Text style={styles.nextReview}>
              Next review: {progress.nextReview.toLocaleDateString()}
            </Text>
          )}
          <Text style={styles.streak}>
            Streak: {progress.retentionStreak} 🔥
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No learning progress yet</Text>
      <TouchableOpacity 
        style={styles.initializeButton}
        onPress={handleInitializeSampleData}
      >
        <Text style={styles.initializeButtonText}>Initialize Sample Data</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Learning Progress</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={loadData}
        >
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {conceptProgress.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {renderDueReviews()}
          {renderConceptProgress()}
        </>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  reviewItem: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  reviewDue: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '500',
  },
  reviewDifficulty: {
    color: '#666',
    fontSize: 14,
  },
  conceptItem: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  conceptName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  masteryBarContainer: {
    height: 8,
    backgroundColor: '#222',
    borderRadius: 4,
    marginVertical: 8,
    overflow: 'hidden',
  },
  masteryBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  nextReview: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  streak: {
    color: '#FFA000',
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  initializeButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  initializeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 