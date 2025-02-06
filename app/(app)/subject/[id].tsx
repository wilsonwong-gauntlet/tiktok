import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Subject, Concept } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { auth } from '../../../services/firebase';

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubject();
  }, [id]);

  const loadSubject = async () => {
    if (!auth.currentUser || !id) return;

    try {
      setLoading(true);
      setError(null);
      const subjectData = await SubjectService.getSubjectById(id as string, auth.currentUser.uid);
      
      if (!subjectData) {
        setError('Subject not found');
        return;
      }

      setSubject(subjectData);
    } catch (error) {
      console.error('Error loading subject:', error);
      setError('Failed to load subject');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = (progress: number) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
    </View>
  );

  const renderConcept = (concept: Concept) => {
    const getStatusColor = () => {
      switch (concept.status) {
        case 'mastered':
          return '#2E7D32';
        case 'in_progress':
          return '#F57F17';
        default:
          return '#666';
      }
    };

    return (
      <TouchableOpacity 
        key={concept.id}
        style={styles.conceptItem}
        onPress={() => router.push(`/concept/${concept.id}`)}
      >
        <View style={styles.conceptHeader}>
          <Text style={styles.conceptName}>{concept.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>
              {concept.status.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.conceptDescription}>{concept.description}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  if (error || !subject) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Subject not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSubject}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{subject.name}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>{subject.description}</Text>
        
        <View style={styles.progressSection}>
          {renderProgressBar(subject.progress)}
          <Text style={styles.progressText}>{subject.progress}% Complete</Text>
          <Text style={styles.statsText}>
            {subject.completedVideos} / {subject.videosCount} videos watched
          </Text>
        </View>

        <View style={styles.graphSection}>
          <Text style={styles.sectionTitle}>Knowledge Graph</Text>
          <View style={styles.graphPlaceholder}>
            <Text style={styles.graphText}>Knowledge graph visualization coming soon...</Text>
          </View>
        </View>

        <View style={styles.conceptsSection}>
          <Text style={styles.sectionTitle}>Core Concepts</Text>
          {subject.concepts.map(renderConcept)}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 24,
    lineHeight: 24,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1a472a',
  },
  progressText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  graphSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  graphPlaceholder: {
    height: 200,
    backgroundColor: '#222',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  graphText: {
    color: '#666',
    textAlign: 'center',
  },
  conceptsSection: {
    marginBottom: 24,
  },
  conceptItem: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  conceptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conceptName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  conceptDescription: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
}); 