import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { VideoSummary } from '../types/video';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';

interface VideoSummarySectionProps {
  summary?: VideoSummary;
  isLoading: boolean;
  onGenerateSummary: () => void;
  transcription?: string;
  transcriptionStatus?: 'pending' | 'completed' | 'error';
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
  transcription,
  transcriptionStatus
}: VideoSummarySectionProps) {
  const [showTranscription, setShowTranscription] = useState(false);

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

  const renderTranscriptionStatus = () => {
    switch (transcriptionStatus) {
      case 'pending':
        return (
          <View style={styles.transcriptionStatus}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.statusText}>Transcribing video...</Text>
          </View>
        );
      case 'error':
        return (
          <View style={styles.transcriptionStatus}>
            <Ionicons name="alert-circle" size={20} color="#ff4444" />
            <Text style={[styles.statusText, { color: '#ff4444' }]}>
              Failed to transcribe video
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Points</Text>
        {summary.key_points.map((point: string, index: number) => (
          <View key={index} style={styles.card}>
            <Markdown style={markdownStyles}>
              {point}
            </Markdown>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Main Concepts</Text>
        <View style={styles.card}>
          <View style={styles.conceptsContainer}>
            {summary.main_concepts.map((concept: string, index: number) => (
              <View key={index} style={styles.conceptTag}>
                <Markdown style={markdownStyles}>
                  {concept}
                </Markdown>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.transcriptionHeader}
          onPress={() => setShowTranscription(!showTranscription)}
        >
          <Text style={styles.sectionTitle}>Transcription</Text>
          <Ionicons 
            name={showTranscription ? "chevron-up" : "chevron-down"} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
        
        {renderTranscriptionStatus()}
        
        {showTranscription && transcription && (
          <View style={styles.card}>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </View>
        )}
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
    marginTop: -4,
    marginBottom: -4,
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
  transcriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transcriptionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  transcriptionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
}); 