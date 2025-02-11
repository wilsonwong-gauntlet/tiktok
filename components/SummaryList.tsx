import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from '../types/video';
import { VideoService } from '../services/firebase/video';
import { useRouter } from 'expo-router';

interface SummaryListProps {
  videos?: Video[];
}

export default function SummaryList({ videos = [] }: SummaryListProps) {
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<{[key: string]: any}>({});
  const [loading, setLoading] = useState<{[key: string]: boolean}>({});
  const router = useRouter();

  const loadSummary = async (videoId: string) => {
    if (summaries[videoId] || loading[videoId]) return;

    try {
      setLoading(prev => ({ ...prev, [videoId]: true }));
      const summary = await VideoService.getSummary(videoId);
      setSummaries(prev => ({ ...prev, [videoId]: summary }));
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoading(prev => ({ ...prev, [videoId]: false }));
    }
  };

  const handleExpand = (videoId: string) => {
    if (expandedVideoId === videoId) {
      setExpandedVideoId(null);
    } else {
      setExpandedVideoId(videoId);
      loadSummary(videoId);
    }
  };

  const videosWithSummaries = (videos || []).filter(video => video.summary);

  return (
    <ScrollView style={styles.container}>
      {videosWithSummaries.map(video => (
        <View key={video.id} style={styles.videoSection}>
          <TouchableOpacity
            style={styles.videoHeader}
            onPress={() => handleExpand(video.id)}
          >
            <View>
              <Text style={styles.videoTitle}>{video.title}</Text>
            </View>
            <Ionicons
              name={expandedVideoId === video.id ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          {expandedVideoId === video.id && (
            <View style={styles.summaryContent}>
              {loading[video.id] ? (
                <Text style={styles.loadingText}>Loading summary...</Text>
              ) : summaries[video.id] ? (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Key Points</Text>
                    {summaries[video.id].key_points.map((point: string, index: number) => (
                      <View key={index} style={styles.point}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Main Concepts</Text>
                    <View style={styles.conceptsGrid}>
                      {summaries[video.id].main_concepts.map((concept: string, index: number) => (
                        <View key={index} style={styles.conceptTag}>
                          <Text style={styles.conceptText}>{concept}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={styles.watchButton}
                    onPress={() => router.push(`/video/${video.id}`)}
                  >
                    <Ionicons name="play-circle-outline" size={20} color="#fff" />
                    <Text style={styles.watchButtonText}>Watch Full Video</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.errorText}>
                  Failed to load summary. Please try again.
                </Text>
              )}
            </View>
          )}
        </View>
      ))}

      {videosWithSummaries.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#666" />
          <Text style={styles.emptyTitle}>No Summaries Yet</Text>
          <Text style={styles.emptyText}>
            Start watching videos to access key points and main concepts
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
  },
  summaryContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  point: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    color: '#666',
    marginRight: 8,
    fontSize: 16,
  },
  pointText: {
    flex: 1,
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  conceptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conceptTag: {
    backgroundColor: '#6B21A8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  conceptText: {
    color: '#fff',
    fontSize: 14,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#6B21A8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  watchButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
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