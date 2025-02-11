import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from '../types/video';
import { useRouter } from 'expo-router';

interface ReadingListProps {
  videos: Video[];
}

export default function ReadingList({ videos }: ReadingListProps) {
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const router = useRouter();

  const videosWithReading = videos.filter(video => 
    video.furtherReading && video.furtherReading.length > 0
  );

  return (
    <ScrollView style={styles.container}>
      {videosWithReading.map(video => (
        <View key={video.id} style={styles.videoSection}>
          <TouchableOpacity
            style={styles.videoHeader}
            onPress={() => setExpandedVideoId(
              expandedVideoId === video.id ? null : video.id
            )}
          >
            <View>
              <Text style={styles.videoTitle}>{video.title}</Text>
              <Text style={styles.resourceCount}>
                {video.furtherReading?.length} resources
              </Text>
            </View>
            <Ionicons
              name={expandedVideoId === video.id ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          {expandedVideoId === video.id && video.furtherReading && (
            <View style={styles.readingList}>
              {video.furtherReading.map((reading, index) => (
                <View key={index} style={styles.readingCard}>
                  <Text style={styles.readingTitle}>{reading.title}</Text>
                  <Text style={styles.readingAuthor}>By {reading.author}</Text>
                  <Text style={styles.readingDescription}>
                    {reading.description}
                  </Text>
                  {reading.url && (
                    <TouchableOpacity style={styles.readButton}>
                      <Text style={styles.readButtonText}>Read Now</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      {videosWithReading.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={48} color="#666" />
          <Text style={styles.emptyTitle}>No Reading Materials Yet</Text>
          <Text style={styles.emptyText}>
            Start watching videos to discover recommended reading materials and resources
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  videoSection: {
    backgroundColor: '#222',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  resourceCount: {
    fontSize: 14,
    color: '#666',
  },
  readingList: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  readingCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  readingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  readingAuthor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  readingDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    marginBottom: 12,
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#6B21A8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  readButtonText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 4,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
}); 