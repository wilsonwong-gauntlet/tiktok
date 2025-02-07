import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FurtherReading } from '../types/video';

interface ReadingListProps {
  readings: {
    [subjectId: string]: {
      subjectName: string;
      resources: {
        videoId: string;
        videoTitle: string;
        resource: FurtherReading;
      }[];
    };
  };
  onResourcePress: (videoId: string, resource: FurtherReading) => void;
}

export default function ReadingList({ readings, onResourcePress }: ReadingListProps) {
  // Flatten the readings data structure
  const flatReadings = Object.entries(readings).flatMap(([subjectId, { subjectName, resources }]) =>
    resources.map(({ videoId, videoTitle, resource }) => ({
      subjectId,
      subjectName,
      videoId,
      videoTitle,
      ...resource,
    }))
  );

  const renderReadingRow = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onResourcePress(item.videoId, item)}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            <Ionicons name="book-outline" size={16} color="#666" />
            <View style={styles.textContent}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.author} numberOfLines={1}>by {item.author}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {item.subjectName} • From {item.videoTitle}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={flatReadings}
        renderItem={renderReadingRow}
        keyExtractor={(item, index) => `${item.videoId}-${index}`}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No reading materials</Text>
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
  textContent: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  author: {
    color: '#666',
    fontSize: 12,
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
}); 