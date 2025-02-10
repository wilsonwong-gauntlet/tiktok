import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  ScrollView,
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
  cachedInsights: {
    videoId: string;
    summary: string;
    confusionPoints: string[];
    valuableInsights: string[];
    sentiment: string;
    commentCount: number;
    savedAt: Date;
    videoTitle?: string;
  }[];
  loading: boolean;
}

export default function SavedInsights({ cachedInsights, loading }: SavedInsightsProps) {
  const router = useRouter();

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        {[1, 2, 3].map((_, index) => (
          <View key={index} style={[styles.insightCard, styles.skeletonCard]}>
            <View style={[styles.skeletonText, { width: '70%', marginBottom: 12 }]} />
            <View style={[styles.skeletonText, { width: '90%', height: 60, marginBottom: 16 }]} />
            <View style={styles.insightSection}>
              <View style={[styles.skeletonText, { width: '40%', marginBottom: 8 }]} />
              {[1, 2].map((_, i) => (
                <View key={i} style={[styles.skeletonText, { width: '80%', marginBottom: 4 }]} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  const renderInsightRow = ({ item: insight }: { item: SavedInsightsProps['cachedInsights'][0] }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/insight/${insight.videoId}`)}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            <Ionicons name="chatbubbles-outline" size={16} color="#666" />
            <Text style={styles.summaryText} numberOfLines={2}>
              {insight.summary}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {insight.commentCount || 0} comments • {insight.savedAt.toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={cachedInsights}
        renderItem={renderInsightRow}
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
  insightCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 4,
    marginBottom: 16,
  },
  insightSection: {
    flexDirection: 'row',
    gap: 16,
  },
  skeletonCard: {
    opacity: 0.7,
  },
  skeletonText: {
    backgroundColor: '#333',
    borderRadius: 4,
    height: 16,
  },
}); 