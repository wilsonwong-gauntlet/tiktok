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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
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

  const toggleSelection = (videoId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId);
    } else {
      newSelection.add(videoId);
    }
    setSelectedItems(newSelection);
    setIsSelectionMode(newSelection.size > 0);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === savedSummaries.length) {
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedItems(new Set(savedSummaries.map(summary => summary.videoId)));
    }
  };

  const handleBulkShare = async () => {
    if (selectedItems.size === 0) return;

    const selectedSummaries = savedSummaries.filter(summary => 
      selectedItems.has(summary.videoId)
    );

    const summaryText = selectedSummaries.map(summary => [
      `📊 Community Insights Summary for ${summary.videoTitle || 'Video'}`,
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
      '-------------------',
    ].join('\n')).join('\n\n');

    try {
      await Share.share({
        message: summaryText,
      });
    } catch (error) {
      console.error('Error sharing summaries:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!auth.currentUser || selectedItems.size === 0) return;

    try {
      const deletePromises = Array.from(selectedItems).map(videoId => 
        deleteDoc(doc(db, `users/${auth.currentUser!.uid}/savedSummaries/${videoId}`))
      );
      await Promise.all(deletePromises);

      const updatedSummaries = savedSummaries.filter(
        summary => !selectedItems.has(summary.videoId)
      );
      setSavedSummaries(updatedSummaries);
      onDataLoaded?.(updatedSummaries);
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    } catch (error) {
      console.error('Error deleting summaries:', error);
    }
  };

  const renderSummaryRow = ({ item: summary }: { item: SavedSummary }) => (
    <TouchableOpacity 
      style={[
        styles.row,
        selectedItems.has(summary.videoId) && styles.selectedRow
      ]}
      onLongPress={() => {
        setIsSelectionMode(true);
        toggleSelection(summary.videoId);
      }}
      onPress={() => {
        if (isSelectionMode) {
          toggleSelection(summary.videoId);
        } else {
          router.push(`/video/${summary.videoId}`);
        }
      }}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            {isSelectionMode && (
              <Ionicons 
                name={selectedItems.has(summary.videoId) ? "checkbox" : "square-outline"} 
                size={20} 
                color={selectedItems.has(summary.videoId) ? "#1a472a" : "#666"}
                style={styles.checkbox}
              />
            )}
            <Ionicons name="chatbubbles-outline" size={16} color="#666" />
            <Text style={styles.summaryText} numberOfLines={2}>
              {summary.summary}
            </Text>
          </View>
          {!isSelectionMode && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleRemoveSummary(summary.videoId)}
            >
              <Ionicons name="trash-outline" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {summary.commentCount} comments • {summary.savedAt.toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => {
    if (!isSelectionMode || savedSummaries.length === 0) return null;

    return (
      <View style={styles.selectionHeader}>
        <TouchableOpacity 
          style={styles.selectionButton} 
          onPress={toggleSelectAll}
        >
          <Ionicons 
            name={selectedItems.size === savedSummaries.length ? "checkbox" : "square-outline"} 
            size={20} 
            color="#666" 
          />
          <Text style={styles.selectionButtonText}>
            {selectedItems.size === savedSummaries.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
        <View style={styles.selectionActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleBulkShare}
          >
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleBulkDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#666" />
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