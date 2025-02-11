import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Subject, Video } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { VideoService } from '../../../services/firebase/video';
import { auth } from '../../../services/firebase';
import VideoList from '../../../components/VideoList';
import ReadingList from '../../../components/ReadingList';
import SummaryList from '../../../components/SummaryList';
import QuizList from '../../../components/QuizList';
import ReflectionList from '../../../components/ReflectionList';
import ProgressBar from '../../../components/ProgressBar';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

interface SectionContentProps {
  section: string;
  onBack: () => void;
  videos: Video[];
  subject: Subject;
}

function SectionContent({ section, onBack, videos, subject }: SectionContentProps) {
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

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [nextVideo, setNextVideo] = useState<Video | null>(null);
  const [progress, setProgress] = useState({
    videos: 0,
    quizzes: 0,
    overall: 0
  });

  useEffect(() => {
    loadSubject();
  }, [id]);

  useEffect(() => {
    if (videos.length > 0) {
      determineNextVideo();
      calculateProgress();
    }
  }, [videos]);

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
      const subjectVideos = await VideoService.getVideosBySubject(id as string);
      setVideos(subjectVideos);

    } catch (error) {
      console.error('Error loading subject:', error);
      setError('Failed to load subject');
    } finally {
      setLoading(false);
    }
  };

  const determineNextVideo = () => {
    const next = videos.find(v => !v.completed) || videos[0];
    setNextVideo(next);
  };

  const calculateProgress = () => {
    if (!videos.length) return;

    const videoProgress = videos.filter(v => v.completed).length / videos.length;
    const quizProgress = videos.filter(v => v.quiz?.completed).length / videos.filter(v => v.quiz).length;
    
    setProgress({
      videos: videoProgress * 100,
      quizzes: quizProgress * 100,
      overall: ((videoProgress + quizProgress) / 2) * 100
    });
  };

  const renderMainContent = () => (
    <ScrollView style={styles.container}>
      {/* Subject Title */}
      <View style={styles.titleSection}>
        <Text style={styles.subjectTitle}>{subject?.name}</Text>
        <Text style={styles.videoCount}>{videos.length} videos</Text>
      </View>

      {/* Main Video Section */}
      <TouchableOpacity 
        style={styles.mainCard}
        onPress={() => setSelectedSection('videos')}
      >
        <View style={styles.mainCardContent}>
          <Ionicons name="play-circle" size={32} color="#fff" />
          <Text style={styles.mainCardTitle}>Video Lessons</Text>
          <Text style={styles.mainCardSubtext}>Start learning</Text>
        </View>
      </TouchableOpacity>

      {/* Learning Tools Grid */}
      <View style={styles.toolsGrid}>
        <TouchableOpacity 
          style={styles.toolCard}
          onPress={() => setSelectedSection('summaries')}
        >
          <Ionicons name="document-text" size={24} color="#fff" />
          <Text style={styles.toolTitle}>Summaries</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolCard}
          onPress={() => setSelectedSection('quizzes')}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.toolTitle}>Quizzes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolCard}
          onPress={() => setSelectedSection('reading')}
        >
          <Ionicons name="book" size={24} color="#fff" />
          <Text style={styles.toolTitle}>Reading</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolCard}
          onPress={() => setSelectedSection('reflections')}
        >
          <Ionicons name="journal" size={24} color="#fff" />
          <Text style={styles.toolTitle}>Notes</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{subject.name}</Text>
      </View>

      {selectedSection ? (
        <SectionContent 
          section={selectedSection}
          onBack={() => setSelectedSection(null)}
          videos={videos}
          subject={subject}
        />
      ) : (
        renderMainContent()
      )}
    </View>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
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
  titleSection: {
    padding: 20,
  },
  subjectTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  videoCount: {
    fontSize: 16,
    color: '#666',
  },
  mainCard: {
    backgroundColor: '#6B21A8', // Obsidian purple
    margin: 20,
    borderRadius: 16,
    padding: 24,
  },
  mainCardContent: {
    alignItems: 'center',
    gap: 12,
  },
  mainCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  mainCardSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 20,
  },
  toolCard: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
    width: (WINDOW_WIDTH - 52) / 2, // Account for padding and gap
    alignItems: 'center',
    gap: 12,
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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