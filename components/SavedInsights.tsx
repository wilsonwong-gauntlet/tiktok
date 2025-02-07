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
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

interface SavedSummary {
  videoId: string;
  summary: string;
  confusionPoints: string[];
  valuableInsights: string[];
  sentiment: string;
  commentCount: number;
  savedAt: Date;
}

export default function SavedInsights() {
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadSavedSummaries();
  }, []);

  const loadSavedSummaries = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      setError(null);
      
      const summariesRef = collection(db, `users/${auth.currentUser.uid}/savedSummaries`);
      const summariesSnapshot = await getDocs(query(summariesRef));
      
      const summaries = summariesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        savedAt: doc.data().savedAt?.toDate(),
      })) as SavedSummary[];

      setSavedSummaries(summaries.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime()));
    } catch (error) {
      console.error('Error loading saved summaries:', error);
      setError('Failed to load saved summaries');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSummary = async (videoId: string) => {
    if (!auth.currentUser) return;

    try {
      const summaryRef = doc(db, `users/${auth.currentUser.uid}/savedSummaries/${videoId}`);
      await deleteDoc(summaryRef);
      setSavedSummaries(prev => prev.filter(summary => summary.videoId !== videoId));
    } catch (error) {
      console.error('Error removing summary:', error);
    }
  };

  const handleShareSummary = async (summary: SavedSummary) => {
    const summaryText = [
      '📊 Community Insights Summary',
      '',
      '💭 Main Discussion:',
      summary.summary,
      '',
      '❓ Key Areas of Confusion:',
      ...summary.confusionPoints.map(point => `• ${point}`),
      '',
      '💡 Valuable Insights:',
      ...summary.valuableInsights.map(insight => `• ${insight}`),
      '',
      '❤️ Community Engagement:',
      summary.sentiment,
      '',
      `Based on ${summary.commentCount} comments`,
    ].join('\n');

    try {
      await Share.share({
        message: summaryText,
      });
    } catch (error) {
      console.error('Error sharing summary:', error);
    }
  };

  const renderSummaryCard = ({ item: summary }: { item: SavedSummary }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics" size={24} color="#fff" />
          <Text style={styles.headerTitle}>Community Insights</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShareSummary(summary)}
          >
            <Ionicons name="share-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRemoveSummary(summary.videoId)}
          >
            <Ionicons name="trash-outline" size={20} color="#ff4444" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="chatbubbles-outline" size={16} color="#fff" /> Main Discussion
          </Text>
          <Text style={styles.sectionText}>{summary.summary}</Text>
        </View>

        {summary.confusionPoints.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="help-circle-outline" size={16} color="#fff" /> Areas of Confusion
            </Text>
            {summary.confusionPoints.map((point, index) => (
              <Text key={index} style={styles.bulletPoint}>• {point}</Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="bulb-outline" size={16} color="#fff" /> Valuable Insights
          </Text>
          {summary.valuableInsights.map((insight, index) => (
            <Text key={index} style={styles.bulletPoint}>• {insight}</Text>
          ))}
        </View>

        <TouchableOpacity
          style={styles.viewVideoButton}
          onPress={() => router.push(`/video/${summary.videoId}`)}
        >
          <Text style={styles.viewVideoText}>View Video</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

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
      <FlatList
        data={savedSummaries}
        renderItem={renderSummaryCard}
        keyExtractor={item => item.videoId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>No saved insights yet</Text>
            <Text style={styles.emptySubtext}>
              Bookmark community insights from videos to save them here
            </Text>
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
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#222',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  actionButton: {
    padding: 4,
  },
  cardContent: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  bulletPoint: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    marginBottom: 4,
  },
  viewVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  viewVideoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 32,
  },
}); 