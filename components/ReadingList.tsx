import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Share,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FurtherReading } from '../types/video';
import { useRouter } from 'expo-router';

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
  loading?: boolean;
}

export default function ReadingList({ readings, onResourcePress, loading }: ReadingListProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const router = useRouter();

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        {[1, 2, 3].map((_, index) => (
          <View key={index} style={styles.section}>
            <View style={[styles.skeletonText, { width: '40%', marginBottom: 12 }]} />
            <View style={styles.resourcesList}>
              {[1, 2].map((_, resourceIndex) => (
                <View key={resourceIndex} style={[styles.resourceCard, styles.skeletonCard]}>
                  <View style={[styles.skeletonText, { width: '70%', marginBottom: 8 }]} />
                  <View style={[styles.skeletonText, { width: '40%', marginBottom: 8 }]} />
                  <View style={[styles.skeletonText, { width: '90%' }]} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  // Flatten the readings data structure
  const flatReadings = Object.entries(readings).flatMap(([subjectId, { subjectName, resources }]) =>
    resources.map(({ videoId, videoTitle, resource }) => ({
      id: `${videoId}-${resource.title}`,
      subjectId,
      subjectName,
      videoId,
      videoTitle,
      ...resource,
    }))
  );

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
    setIsSelectionMode(newSelection.size > 0);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === flatReadings.length) {
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedItems(new Set(flatReadings.map(reading => reading.id)));
    }
  };

  const handleBulkShare = async () => {
    if (selectedItems.size === 0) return;

    const selectedReadings = flatReadings.filter(reading => 
      selectedItems.has(reading.id)
    );

    const readingText = selectedReadings.map(reading => [
      `📚 Reading Resource from ${reading.videoTitle}`,
      '',
      `Title: ${reading.title}`,
      `Author: ${reading.author}`,
      '',
      'Description:',
      reading.description,
      '',
      `Subject: ${reading.subjectName}`,
      '-------------------',
    ].join('\n')).join('\n\n');

    try {
      await Share.share({
        message: readingText,
      });
    } catch (error) {
      console.error('Error sharing readings:', error);
    }
  };

  const renderReadingRow = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.row,
        selectedItems.has(item.id) && styles.selectedRow
      ]}
      onLongPress={() => {
        setIsSelectionMode(true);
        toggleSelection(item.id);
      }}
      onPress={() => {
        if (isSelectionMode) {
          toggleSelection(item.id);
        } else {
          router.push(`/reading/${encodeURIComponent(item.title)}?videoId=${item.videoId}`);
        }
      }}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            {isSelectionMode && (
              <Ionicons 
                name={selectedItems.has(item.id) ? "checkbox" : "square-outline"} 
                size={20} 
                color={selectedItems.has(item.id) ? "#1a472a" : "#666"}
                style={styles.checkbox}
              />
            )}
            <Ionicons name="book-outline" size={16} color="#666" />
            <View style={styles.textContent}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.author} numberOfLines={1}>by {item.author}</Text>
            </View>
          </View>
          {!isSelectionMode && (
            <Ionicons name="chevron-forward" size={16} color="#666" />
          )}
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {item.subjectName} • From {item.videoTitle}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => {
    if (!isSelectionMode || flatReadings.length === 0) return null;

    return (
      <View style={styles.selectionHeader}>
        <TouchableOpacity 
          style={styles.selectionButton} 
          onPress={toggleSelectAll}
        >
          <Ionicons 
            name={selectedItems.size === flatReadings.length ? "checkbox" : "square-outline"} 
            size={20} 
            color="#666" 
          />
          <Text style={styles.selectionButtonText}>
            {selectedItems.size === flatReadings.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
        <View style={styles.selectionActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleBulkShare}
          >
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={flatReadings}
        renderItem={renderReadingRow}
        keyExtractor={item => item.id}
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
  section: {
    padding: 16,
    marginBottom: 16,
  },
  resourcesList: {
    gap: 12,
  },
  resourceCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedRow: {
    backgroundColor: '#333',
  },
  rowContent: {
    gap: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  author: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  description: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
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
  separator: {
    height: 1,
    backgroundColor: '#222',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: '#666',
    fontSize: 12,
  },
  skeletonCard: {
    opacity: 0.7,
  },
  skeletonText: {
    height: 16,
    backgroundColor: '#333',
    borderRadius: 4,
  },
}); 