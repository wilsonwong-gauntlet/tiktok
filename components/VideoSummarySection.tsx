import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { VideoSummary } from '../types/video';

interface VideoSummarySectionProps {
  summary?: VideoSummary;
  isLoading: boolean;
  onGenerateSummary: () => void;
}

export default function VideoSummarySection({ 
  summary, 
  isLoading,
  onGenerateSummary 
}: VideoSummarySectionProps) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Generating AI Summary...</Text>
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No summary available yet.</Text>
        <TouchableOpacity style={styles.generateButton} onPress={onGenerateSummary}>
          <Text style={styles.generateButtonText}>Generate Summary</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Points</Text>
        {summary.key_points.map((point: string, index: number) => (
          <View key={index} style={styles.bulletPoint}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{point}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Main Concepts</Text>
        <View style={styles.conceptsContainer}>
          {summary.main_concepts.map((concept: string, index: number) => (
            <View key={index} style={styles.conceptTag}>
              <Text style={styles.conceptText}>{concept}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 5,
    paddingRight: 15,
  },
  bulletDot: {
    color: '#fff',
    marginRight: 8,
    fontSize: 16,
  },
  bulletText: {
    color: '#fff',
    flex: 1,
    fontSize: 16,
  },
  conceptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  conceptTag: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  conceptText: {
    color: '#fff',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginBottom: 15,
  },
  generateButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
}); 