import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Subject } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { auth } from '../../../services/firebase';

// Map subject names to appropriate icons
const getSubjectConfig = (name: string): { icon: string } => {
  const nameLower = name.toLowerCase();
  const configs = {
    math: { icon: 'calculator-outline' },
    science: { icon: 'flask-outline' },
    history: { icon: 'time-outline' },
    language: { icon: 'language-outline' },
    art: { icon: 'color-palette-outline' },
    music: { icon: 'musical-notes-outline' },
    computer: { icon: 'desktop-outline' },
    physics: { icon: 'rocket-outline' },
    chemistry: { icon: 'beaker-outline' },
    biology: { icon: 'leaf-outline' },
    psychology: { icon: 'school-outline' },
    economics: { icon: 'cash-outline' },
    data: { icon: 'bar-chart-outline' },
    network: { icon: 'git-network-outline' },
    design: { icon: 'color-wand-outline' },
  };

  for (const [key, config] of Object.entries(configs)) {
    if (nameLower.includes(key)) {
      return config;
    }
  }

  return { icon: 'book-outline' };
};

export default function SubjectsScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const allSubjects = await SubjectService.getAllSubjects();
      setSubjects(allSubjects);
    } catch (error) {
      console.error('Error loading subjects:', error);
      setError('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const renderSubjectCard = (subject: Subject) => {
    const config = getSubjectConfig(subject.name);
    
    return (
      <TouchableOpacity
        key={subject.id}
        style={styles.card}
        onPress={() => router.push(`/subject/${subject.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={config.icon as any}
              size={24}
              color="#9580FF"
            />
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {subject.name}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#9580FF" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSubjects}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {subjects.map(subject => renderSubjectCard(subject))}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(149, 128, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
}); 