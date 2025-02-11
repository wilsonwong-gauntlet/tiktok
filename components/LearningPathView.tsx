import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LearningPath, LearningPathNode, Video } from '../types/video';
import { LearningService } from '../services/firebase/learning';
import { VideoService } from '../services/firebase/video';
import { auth } from '../services/firebase';

interface LearningPathViewProps {
  subjectId: string;
}

export default function LearningPathView({ subjectId }: LearningPathViewProps) {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [recommendations, setRecommendations] = useState<LearningPathNode[]>([]);
  const [dueReviews, setDueReviews] = useState<LearningPathNode[]>([]);
  const [videos, setVideos] = useState<{ [key: string]: Video }>({});
  const [loading, setLoading] = useState(true);

  const loadPath = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const progress = await LearningService.getUserProgress(auth.currentUser.uid);
      
      let path = progress?.activeLearningPaths[subjectId];
      if (!path) {
        path = await LearningService.generateLearningPath(auth.currentUser.uid, subjectId);
      }
      setLearningPath(path);

      // Load recommendations and due reviews
      const [recNodes, reviewNodes] = await Promise.all([
        LearningService.getRecommendedVideos(auth.currentUser.uid),
        LearningService.getDueReviews(auth.currentUser.uid)
      ]);
      setRecommendations(recNodes);
      setDueReviews(reviewNodes);

      // Load video details
      const videoIds = new Set([
        ...path.nodes.map(node => node.videoId),
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
    } catch (error) {
      console.error('Error loading learning path:', error);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadPath();
  }, [loadPath]);

  const handleNodePress = useCallback((videoId: string) => {
    router.push(`/video/${videoId}`);
  }, []);

  const renderPathNode = useCallback((node: LearningPathNode, index: number) => {
    const video = videos[node.videoId];
    if (!video) return null;

    return (
      <TouchableOpacity
        key={node.videoId}
        style={[
          styles.nodeCard,
          node.completed && styles.completedNode,
          index === learningPath?.currentNodeIndex && styles.currentNode
        ]}
        onPress={() => handleNodePress(node.videoId)}
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
            <Text style={styles.nodeType}>
              {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
            </Text>
            <Text style={styles.nodeDuration}>
              {Math.round(node.estimatedDuration)}min
            </Text>
            {node.score !== undefined && (
              <Text style={styles.nodeScore}>
                Score: {node.score}%
              </Text>
            )}
          </View>
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
    <ScrollView style={styles.container}>
      {/* Learning Path */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Learning Path</Text>
        <Text style={styles.progress}>
          Progress: {Math.round((learningPath?.completionRate || 0) * 100)}%
        </Text>
        {learningPath?.nodes.map((node, index) => renderPathNode(node, index))}
      </View>

      {/* Due Reviews */}
      {dueReviews.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due for Review</Text>
          {dueReviews.map((node, index) => renderPathNode(node, index))}
        </View>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended for You</Text>
          {recommendations.map((node, index) => renderPathNode(node, index))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a472a',
  },
  progress: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  nodeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
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
    backgroundColor: '#f5f9f7',
  },
  currentNode: {
    borderColor: '#1a472a',
    borderWidth: 2,
  },
  thumbnail: {
    width: 120,
    height: 67.5, // 16:9 aspect ratio
    borderRadius: 4,
    marginRight: 12,
  },
  nodeContent: {
    flex: 1,
  },
  nodeTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#333',
  },
  nodeMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nodeType: {
    fontSize: 14,
    color: '#666',
  },
  nodeDuration: {
    fontSize: 14,
    color: '#666',
  },
  nodeScore: {
    fontSize: 14,
    color: '#1a472a',
    fontWeight: '600',
  },
}); 