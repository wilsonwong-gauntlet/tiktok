import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Subject } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { auth } from '../../../services/firebase';
import { router } from 'expo-router';

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 10;
const CARD_WIDTH = (WINDOW_WIDTH - CARD_MARGIN * 4) / 2;

export default function SubjectsScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    if (!auth.currentUser) {
      console.log('No authenticated user found');
      return;
    }

    try {
      console.log('Loading subjects for user:', auth.currentUser.uid);
      setLoading(true);
      setError(null);
      const fetchedSubjects = await SubjectService.getSubjects(auth.currentUser.uid);
      console.log('Fetched subjects:', fetchedSubjects);
      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error('Error loading subjects:', error);
      setError('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text: string) => {
    if (!auth.currentUser) return;
    
    setSearchQuery(text);
    if (!text) {
      loadSubjects();
      return;
    }

    try {
      setLoading(true);
      const searchResults = await SubjectService.searchSubjects(text, auth.currentUser.uid);
      setSubjects(searchResults);
    } catch (error) {
      console.error('Error searching subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = (progress: number) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
    </View>
  );

  const renderSubjectCard = (subject: Subject) => (
    <TouchableOpacity 
      key={subject.id}
      style={styles.card}
      onPress={() => router.push(`/subject/${subject.id}`)}
    >
      <Text style={styles.cardTitle}>{subject.name}</Text>
      {renderProgressBar(subject.progress)}
      <Text style={styles.progressText}>{subject.progress}% Complete</Text>
      <Text style={styles.statsText}>
        {subject.completedVideos} / {subject.videosCount} videos watched
      </Text>
      <View style={styles.graphPlaceholder}>
        <Text style={styles.graphText}>Knowledge Graph</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && !subjects.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSubjects}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Subjects</Text>
        <Text style={styles.subtitle}>Explore learning categories</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search subjects..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
      >
        {subjects.map(renderSubjectCard)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    margin: 20,
    marginTop: 0,
    borderRadius: 10,
    padding: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: CARD_MARGIN,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 15,
    margin: CARD_MARGIN,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1a472a',
  },
  progressText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 5,
  },
  statsText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  graphPlaceholder: {
    height: 100,
    backgroundColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphText: {
    color: '#666',
    fontSize: 12,
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