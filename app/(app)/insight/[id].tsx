import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';

interface InsightDetails {
  videoId: string;
  videoTitle?: string;
  summary: string;
  confusionPoints: string[];
  valuableInsights: string[];
  sentiment: string;
  commentCount: number;
  savedAt: Date;
}

export default function InsightDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [insight, setInsight] = useState<InsightDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsight();
  }, [id]);

  const loadInsight = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const insightRef = doc(db, `users/${auth.currentUser.uid}/savedSummaries/${id}`);
      const insightDoc = await getDoc(insightRef);

      if (insightDoc.exists()) {
        const data = insightDoc.data();
        setInsight({
          ...data,
          savedAt: data.savedAt?.toDate() || new Date(),
        } as InsightDetails);
      }
    } catch (error) {
      console.error('Error loading insight:', error);
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
          <Text style={styles.title}>Community Insights</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!insight) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Community Insights</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Insight not found</Text>
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
        <Text style={styles.title}>Community Insights</Text>
      </View>

      <ScrollView style={styles.content}>
        {insight.videoTitle && (
          <Text style={styles.videoTitle}>{insight.videoTitle}</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summaryText}>{insight.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Points of Discussion</Text>
          {insight.valuableInsights.map((point, index) => (
            <View key={index} style={styles.point}>
              <Ionicons name="bulb-outline" size={20} color="#1a472a" />
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Areas of Confusion</Text>
          {insight.confusionPoints.map((point, index) => (
            <View key={index} style={styles.point}>
              <Ionicons name="help-circle-outline" size={20} color="#ff4444" />
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Engagement</Text>
          <View style={styles.engagementInfo}>
            <Ionicons name="people-outline" size={20} color="#666" />
            <Text style={styles.engagementText}>
              {insight.commentCount} comments • {insight.sentiment}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.watchButton}
          onPress={() => router.push(`/video/${insight.videoId}`)}
        >
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.watchButtonText}>Watch Video</Text>
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
  videoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
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
  summaryText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  pointText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  engagementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  engagementText: {
    fontSize: 16,
    color: '#666',
  },
  watchButton: {
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
  watchButtonText: {
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
    fontSize: 16,
  },
}); 