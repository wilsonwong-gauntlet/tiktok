import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FurtherReading } from '../types/video';
import { useRouter } from 'expo-router';

interface ReadingItem {
  videoId: string;
  videoTitle: string;
  subjectName: string;
  resource: FurtherReading;
}

interface ReadingListProps {
  readings: ReadingItem[];
  loading?: boolean;
}

export default function ReadingList({ readings = [], loading = false }: ReadingListProps) {
  const router = useRouter();

  const renderReadingRow = ({ item: reading }: { item: ReadingItem }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/reading/${encodeURIComponent(reading.resource.title)}?videoId=${reading.videoId}`)}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            <Ionicons name="book-outline" size={16} color="#666" />
            <Text style={styles.readingText}>
              {reading.resource.title}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {reading.subjectName} • From {reading.videoTitle} • By {reading.resource.author}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading reading materials...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Reading Materials ({readings.length})</Text>
      </View>
      <FlatList
        data={readings}
        renderItem={renderReadingRow}
        keyExtractor={(item, index) => `${item.videoId}-${index}`}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No reading materials yet</Text>
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
  readingText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
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
  loadingText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
}); 