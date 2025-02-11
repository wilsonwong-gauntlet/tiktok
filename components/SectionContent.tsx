import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Subject, Video } from '../types/video';
import VideoList from './VideoList';
import ReadingList from './ReadingList';
import SummaryList from './SummaryList';
import QuizList from './QuizList';
import ReflectionList from './ReflectionList';

interface SectionContentProps {
  section: string;
  onBack: () => void;
  videos: Video[];
  subject: Subject;
}

export default function SectionContent({ section, onBack, videos, subject }: SectionContentProps) {
  const renderContent = () => {
    switch (section) {
      case 'videos':
        return <VideoList videos={videos} />;
      case 'reading':
        return <ReadingList videos={videos} />;
      case 'summaries':
        return <SummaryList videos={videos} />;
      case 'quizzes':
        return <QuizList videos={videos} subject={subject} />;
      case 'reflections':
        return <ReflectionList videos={videos} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {section.charAt(0).toUpperCase() + section.slice(1)}
        </Text>
      </View>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
}); 