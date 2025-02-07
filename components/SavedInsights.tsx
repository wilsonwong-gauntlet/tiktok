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
  videoTitle?: string;
}

interface SavedInsightsProps {
  cachedInsights?: SavedSummary[];
  onDataLoaded?: (insights: SavedSummary[]) => void;
}

export default function SavedInsights({ cachedInsights, onDataLoaded }: SavedInsightsProps) {
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>(cachedInsights || []);
  const [loading, setLoading] = useState(!cachedInsights);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!cachedInsights) {
      loadSavedSummaries();
    }
  }, []);

  const loadSavedSummaries = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      setError(null);
      
      const summariesRef = collection(db, `users/${auth.currentUser.uid}/savedSummaries`);
      const summariesSnapshot = await getDocs(query(summariesRef));
      
      const summaries = summariesSnapshot.docs.map(doc => ({
        videoId: doc.id,
        ...doc.data(),
        savedAt: doc.data().savedAt?.toDate() || new Date(),
      })) as SavedSummary[];

      const sortedSummaries = summaries.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
      setSavedSummaries(sortedSummaries);
      onDataLoaded?.(sortedSummaries);
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
      const updatedSummaries = savedSummaries.filter(summary => summary.videoId !== videoId);
      setSavedSummaries(updatedSummaries);
      onDataLoaded?.(updatedSummaries);
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

  const renderSummaryRow = ({ item: summary }: { item: SavedSummary }) => (
    <TouchableOpacity 
      style={styles.row}
      onPress={() => router.push(`/video/${summary.videoId}`)}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            <Ionicons name="chatbubbles-outline" size={16} color="#666" />
            <Text style={styles.summaryText} numberOfLines={2}>
              {summary.summary}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleRemoveSummary(summary.videoId)}
          >
            <Ionicons name="trash-outline" size={16} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {summary.commentCount} comments • {summary.savedAt.toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
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
        renderItem={renderSummaryRow}
        keyExtractor={item => item.videoId}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No saved insights</Text>
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
  summaryText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  deleteButton: {
    padding: 4,
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
}); 