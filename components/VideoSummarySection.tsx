import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { VideoSummary } from '../types/video';
import Markdown from 'react-native-markdown-display';

interface VideoSummarySectionProps {
  summary?: VideoSummary;
  isLoading: boolean;
  onGenerateSummary: () => void;
}

const markdownStyles = {
  body: {
    color: '#fff',
    fontSize: 16,
  },
  heading1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 10,
  },
  heading2: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginVertical: 8,
  },
  heading3: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 6,
  },
  paragraph: {
    color: '#fff',
    fontSize: 16,
    marginVertical: 4,
  },
  strong: {
    color: '#fff',
    fontWeight: '700',
  },
  em: {
    color: '#fff',
    fontStyle: 'italic',
  },
  link: {
    color: '#9580FF',
    textDecorationLine: 'underline',
  },
  list_item: {
    color: '#fff',
    fontSize: 16,
    marginVertical: 2,
  },
  bullet_list: {
    color: '#fff',
  },
  ordered_list: {
    color: '#fff',
  },
  code_inline: {
    color: '#fff',
    backgroundColor: '#333',
    padding: 4,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  code_block: {
    color: '#fff',
    backgroundColor: '#333',
    padding: 8,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  blockquote: {
    color: '#ccc',
    borderLeftWidth: 4,
    borderLeftColor: '#666',
    paddingLeft: 8,
    marginLeft: 8,
  },
} as const;

export default function VideoSummarySection({ 
  summary, 
  isLoading,
  onGenerateSummary,
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
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Points</Text>
        {summary.key_points
          .filter(point => {
            const cleaned = point.trim().replace(/^\.+/, '').replace(/^#+$/, '');
            return cleaned.length > 0;
          })
          .map((point: string, index: number) => (
            <View key={index} style={styles.card}>
              <Markdown style={markdownStyles}>
                {point.trim().replace(/^\./, '')}
              </Markdown>
            </View>
          ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Main Concepts</Text>
        <View style={styles.conceptsContainer}>
          {summary.main_concepts
            .filter(concept => concept.trim().length > 0)
            .map((concept: string, index: number) => (
              <View key={index} style={styles.conceptTag}>
                <Markdown style={markdownStyles}>
                  {concept.trim().replace(/^\./, '')}
                </Markdown>
              </View>
          ))}
        </View>
      </View>
    </ScrollView>
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
  card: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  conceptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  conceptTag: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginVertical: 4,
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