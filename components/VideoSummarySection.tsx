import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { VideoSummary } from '../types/video';
import { Ionicons } from '@expo/vector-icons';

interface VideoSummarySectionProps {
  summary?: VideoSummary;
  isLoading: boolean;
  onGenerateSummary: () => void;
  transcription?: string;
  transcriptionStatus?: 'pending' | 'completed' | 'error';
}

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
          <View style={styles.transcriptionContent}>
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
  transcriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transcriptionContent: {
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 8,
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