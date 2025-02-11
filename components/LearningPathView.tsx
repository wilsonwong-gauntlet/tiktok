import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LearningPath, LearningPathNode, Video, ConceptMastery } from '../types/video';
import { LearningService } from '../services/firebase/learning';
import { VideoService } from '../services/firebase/video';
import { auth } from '../services/firebase';

interface LearningPathViewProps {
  subjectId: string;
}

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const DIFFICULTY_COLORS = {
  easy: '#4CAF50',
  medium: '#FFC107',
  hard: '#f44336',
} as const;

type DifficultyLevel = keyof typeof DIFFICULTY_COLORS;

const getDifficultyLabel = (difficulty: number): DifficultyLevel => {
  if (difficulty < 40) return 'easy';
  if (difficulty < 70) return 'medium';
  return 'hard';
};

const getRecommendedReviewInterval = (score: number): number => {
  // Spaced repetition intervals in days based on performance
  if (score >= 90) return 14; // Review in 2 weeks
  if (score >= 70) return 7;  // Review in 1 week
  if (score >= 50) return 3;  // Review in 3 days
  return 1; // Review tomorrow
};

type ListItem = 
  | { type: 'header'; title: string; }
  | { type: 'node'; data: LearningPathNode; };

export default function LearningPathView({ subjectId }: LearningPathViewProps) {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [recommendations, setRecommendations] = useState<LearningPathNode[]>([]);
  const [dueReviews, setDueReviews] = useState<LearningPathNode[]>([]);
  const [videos, setVideos] = useState<{ [key: string]: Video }>({});
  const [loading, setLoading] = useState(true);
  const [conceptMastery, setConceptMastery] = useState<{ [key: string]: ConceptMastery }>({});
  const [userStreak, setUserStreak] = useState<number>(0);

  const loadPath = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const progress = await LearningService.getUserProgress(auth.currentUser.uid);
      
      // Load or generate learning path
      let path = progress?.activeLearningPaths?.[subjectId];
      if (!path) {
        path = await LearningService.generateLearningPath(auth.currentUser.uid, subjectId);
      }
      setLearningPath(path);

      // Load concept mastery data
      if (progress?.conceptMastery) {
        setConceptMastery(progress.conceptMastery);
      }

      // Set user streak
      if (progress?.streak) {
        setUserStreak(progress.streak.currentStreak);
      }

      // Load recommendations and due reviews
      if (auth.currentUser) {
        const [recNodes, reviewNodes] = await Promise.all([
          LearningService.getRecommendedVideos(auth.currentUser.uid),
          LearningService.getDueReviews(auth.currentUser.uid)
        ]);

        // Sort recommendations by difficulty based on user's mastery
        const sortedRecs = recNodes.sort((a, b) => {
          const aDifficulty = adjustDifficultyForUser(a.difficulty, a.requiredConcepts);
          const bDifficulty = adjustDifficultyForUser(b.difficulty, b.requiredConcepts);
          return aDifficulty - bDifficulty;
        });

        setRecommendations(sortedRecs);
        setDueReviews(reviewNodes);

        // Load video details
        const videoIds = new Set([
          ...(path?.nodes?.map(node => node.videoId) || []),
          ...recNodes.map(node => node.videoId),
          ...reviewNodes.map(node => node.videoId)
        ]);

        const videoDetails: { [key: string]: Video } = {};
        await Promise.all(
          Array.from(videoIds).map(async (videoId) => {
            const video = await VideoService.fetchVideoById(videoId);
            if (video) {
              videoDetails[videoId] = video;
            }
          })
        );
        setVideos(videoDetails);
      }
    } catch (error) {
      console.error('Error loading learning path:', error);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadPath();
  }, [loadPath]);

  const adjustDifficultyForUser = (baseDifficulty: number, concepts: string[]): number => {
    // Adjust difficulty based on user's mastery of required concepts
    const masteryLevels = concepts.map(conceptId => 
      conceptMastery[conceptId]?.level || 0
    );
    const averageMastery = masteryLevels.length > 0 
      ? masteryLevels.reduce((sum, level) => sum + level, 0) / masteryLevels.length 
      : 0;

    // Reduce difficulty if user has high mastery
    return Math.max(0, Math.min(100, baseDifficulty - (averageMastery * 0.3)));
  };

  const handleNodePress = useCallback(async (node: LearningPathNode) => {
    // Track engagement before navigating
    if (auth.currentUser) {
      try {
        // Just navigate for now, we'll implement engagement tracking later
        router.push(`/video/${node.videoId}`);
      } catch (error) {
        console.error('Error updating node engagement:', error);
      }
    }
  }, []);

  const renderNodeDifficulty = (node: LearningPathNode) => {
    const adjustedDifficulty = adjustDifficultyForUser(node.difficulty, node.requiredConcepts);
    const difficultyLabel = getDifficultyLabel(adjustedDifficulty);
    
    return (
      <View style={[
        styles.difficultyBadge,
        { backgroundColor: DIFFICULTY_COLORS[difficultyLabel] }
      ]}>
        <Text style={styles.difficultyText}>
          {difficultyLabel.charAt(0).toUpperCase() + difficultyLabel.slice(1)}
        </Text>
      </View>
    );
  };

  const renderPathNode = useCallback((node: LearningPathNode, index: number) => {
    const video = videos[node.videoId];
    if (!video) return null;

    const isReview = node.type === 'review';
    const nextReviewDate = node.nextReviewDate ? new Date(node.nextReviewDate) : null;
    const isReviewDue = nextReviewDate && nextReviewDate <= new Date();

    return (
      <TouchableOpacity
        key={node.videoId}
        style={[
          styles.nodeCard,
          node.completed && styles.completedNode,
          index === learningPath?.currentNodeIndex && styles.currentNode,
          isReviewDue && styles.dueReviewNode
        ]}
        onPress={() => handleNodePress(node)}
      >
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={styles.thumbnail}
        />
        <View style={styles.nodeContent}>
          <Text style={styles.nodeTitle} numberOfLines={2}>
            {video.title}
          </Text>
          <View style={styles.nodeMetadata}>
            <View style={styles.nodeTypeContainer}>
              <Ionicons 
                name={
                  node.type === 'core' ? 'school' :
                  node.type === 'practice' ? 'fitness' :
                  node.type === 'review' ? 'refresh-circle' :
                  'trophy'
                } 
                size={16} 
                color="#fff" 
              />
              <Text style={styles.nodeType}>
                {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
              </Text>
            </View>
            {renderNodeDifficulty(node)}
            <Text style={styles.nodeDuration}>
              {Math.round(node.estimatedDuration)}min
            </Text>
            {node.score !== undefined && (
              <Text style={[
                styles.nodeScore,
                { color: node.score >= 70 ? '#4CAF50' : '#FFC107' }
              ]}>
                Score: {node.score}%
              </Text>
            )}
          </View>
          {isReview && nextReviewDate && (
            <Text style={[
              styles.reviewDate,
              isReviewDue && styles.dueReviewDate
            ]}>
              Review {isReviewDue ? 'Due' : 'on'}: {nextReviewDate.toLocaleDateString()}
            </Text>
          )}
        </View>
        {node.completed && (
          <Ionicons name="checkmark-circle" size={24} color="#1a472a" />
        )}
      </TouchableOpacity>
    );
  }, [videos, learningPath, handleNodePress]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a472a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Learning Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="flame" size={24} color="#1a472a" />
          <Text style={styles.statValue}>{userStreak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={24} color="#1a472a" />
          <Text style={styles.statValue}>
            {Object.values(conceptMastery).reduce((sum, c) => sum + (c.level >= 80 ? 1 : 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Concepts Mastered</Text>
        </View>
      </View>

      <FlatList<ListItem>
        data={[
          { type: 'header' as const, title: 'Your Learning Path' },
          ...(learningPath?.nodes || []).map(node => ({ type: 'node' as const, data: node })),
          ...(dueReviews.length > 0 ? [{ type: 'header' as const, title: 'Due for Review' }] : []),
          ...dueReviews.map(node => ({ type: 'node' as const, data: node })),
          ...(recommendations.length > 0 ? [{ type: 'header' as const, title: 'Recommended for You' }] : []),
          ...recommendations.map(node => ({ type: 'node' as const, data: node }))
        ]}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
                {item.title === 'Your Learning Path' && (
                  <Text style={styles.progress}>
                    Progress: {Math.round((learningPath?.completionRate || 0) * 100)}%
                  </Text>
                )}
              </View>
            );
          }
          return renderPathNode(
            item.data,
            learningPath?.nodes.indexOf(item.data) || -1
          );
        }}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        contentContainerStyle={styles.contentContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
    backgroundColor: '#1a1a1a',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f9f7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a472a',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  progress: {
    fontSize: 16,
    color: '#666',
  },
  nodeCard: {
    flexDirection: 'row',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  completedNode: {
    backgroundColor: '#1a1a1a',
  },
  currentNode: {
    borderColor: '#1a472a',
    borderWidth: 2,
  },
  dueReviewNode: {
    borderColor: '#FFC107',
    borderWidth: 1,
  },
  thumbnail: {
    width: 120,
    height: 67.5,
    borderRadius: 8,
    marginRight: 12,
  },
  nodeContent: {
    flex: 1,
  },
  nodeTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  nodeMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  nodeTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a472a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nodeType: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  nodeDuration: {
    fontSize: 12,
    color: '#666',
  },
  nodeScore: {
    fontSize: 12,
    fontWeight: '600',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  dueReviewDate: {
    color: '#FFC107',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
}); 