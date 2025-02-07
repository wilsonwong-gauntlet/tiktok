import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Subject } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { auth } from '../../../services/firebase';

// Map subject names to appropriate icons
const getSubjectIcon = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('math')) return 'calculator-outline';
  if (nameLower.includes('science')) return 'flask-outline';
  if (nameLower.includes('history')) return 'time-outline';
  if (nameLower.includes('language')) return 'language-outline';
  if (nameLower.includes('art')) return 'color-palette-outline';
  if (nameLower.includes('music')) return 'musical-notes-outline';
  if (nameLower.includes('computer')) return 'desktop-outline';
  if (nameLower.includes('physics')) return 'rocket-outline';
  if (nameLower.includes('chemistry')) return 'beaker-outline';
  if (nameLower.includes('biology')) return 'leaf-outline';
  if (nameLower.includes('psychology')) return 'brain-outline';
  if (nameLower.includes('economics')) return 'cash-outline';
  if (nameLower.includes('data')) return 'bar-chart-outline';
  if (nameLower.includes('network')) return 'git-network-outline';
  if (nameLower.includes('design')) return 'color-wand-outline';
  return 'book-outline';
};

export default function SubjectsScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

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

  const handleSubjectPress = (subjectId: string) => {
    setActiveSubject(subjectId);
    router.push(`/subject/${subjectId}`);
  };

  const renderSubjectTab = (subject: Subject) => (
    <TouchableOpacity
      key={subject.id}
      style={[
        styles.tab,
        activeSubject === subject.id && styles.activeTab
      ]}
      onPress={() => handleSubjectPress(subject.id)}
    >
      <View style={styles.tabContent}>
        <Ionicons 
          name={getSubjectIcon(subject.name) as any}
          size={28}
          color="#fff"
        />
        <Text 
          style={styles.tabText}
          numberOfLines={2}
        >
          {subject.name}
        </Text>
      </View>
      {activeSubject === subject.id && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Subjects</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
      >
        <View style={styles.grid}>
          {subjects.map(subject => renderSubjectTab(subject))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const SPACING = 12;
const HORIZONTAL_PADDING = 16;
const itemWidth = (width - (HORIZONTAL_PADDING * 2) - (SPACING * (COLUMNS - 1))) / COLUMNS;

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
  gridContainer: {
    padding: HORIZONTAL_PADDING,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING,
  },
  tab: {
    width: itemWidth,
    aspectRatio: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#222',
  },
  activeTab: {
    backgroundColor: 'rgba(26, 71, 42, 0.2)',
  },
  tabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  tabText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#1a472a',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
}); 