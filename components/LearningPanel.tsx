import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Linking, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FurtherReading, VideoSummary, Video, TranscriptionSegment, ChapterMarker, SmartSeekResult } from '../types/video';
import { saveNote, getNoteForVideo, saveQuizAttempt } from '../services/firebase/learning';
import { VideoService } from '../services/firebase/video';
import { auth } from '../services/firebase/index';
import { Note, Quiz } from '../types/video';
import VideoSummarySection from './VideoSummarySection';
import QuizPanel from './QuizPanel';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface LearningPanelProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  videoId: string;
  video: Video;
  subjectId: string;
  summary?: VideoSummary;
  furtherReading?: FurtherReading[];
  quiz?: Quiz;
  transcription?: string;
  transcriptionStatus?: string;
  onQuizGenerated?: (quiz: Quiz) => void;
  onFurtherReadingGenerated?: (recommendations: FurtherReading[]) => void;
}

type Tab = 'summary' | 'notes' | 'quiz' | 'reading' | 'transcription';

interface Notes {
  content: string;
  keyTakeaways: string[];
}

interface Reflections {
  understanding: string[];
  gaps: string[];
  applications: string[];
  connections: string[];
}

const REFLECTION_TEMPLATE = {
  understanding: [
    "What are the main concepts I learned from this video?",
    "How does this connect to what I already know?",
    "What examples helped me understand the concepts better?"
  ],
  gaps: [
    "What parts of the content were unclear to me?",
    "What questions do I still have?",
    "What topics do I need to review further?"
  ],
  applications: [
    "How can I apply these concepts in my work?",
    "What specific projects could benefit from this knowledge?",
    "What are some real-world examples of these concepts?"
  ],
  connections: [
    "How does this relate to other topics I've learned?",
    "What patterns or principles are similar to other areas?",
    "What interdisciplinary connections can I make?"
  ]
} as const;

export default function LearningPanel({
  visible,
  onClose,
  title,
  videoId,
  video,
  subjectId,
  summary: initialSummary,
  furtherReading,
  quiz,
  transcription,
  transcriptionStatus,
  onQuizGenerated,
  onFurtherReadingGenerated,
}: LearningPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [notes, setNotes] = useState<Notes>({
    content: '',
    keyTakeaways: []
  });
  const [reflections, setReflections] = useState<Reflections>({
    understanding: [],
    gaps: [],
    applications: [],
    connections: []
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [summary, setSummary] = useState<VideoSummary | undefined>(initialSummary);
  const [note, setNote] = useState<Note | null>(null);
  const insets = useSafeAreaInsets();

  // Calculate learning progress based on completed sections
  const getProgressPercentage = () => {
    let completedSections = 0;
    let totalSections = 5; // Total number of sections: summary, transcription, notes, quiz, reading

    if (summary) completedSections++;
    if (transcriptionStatus === 'completed') completedSections++;
    if (notes.content.length > 0) completedSections++;
    if (quiz) completedSections++;
    if (furtherReading && furtherReading.length > 0) completedSections++;

    return Math.round((completedSections / totalSections) * 100);
  };

  useEffect(() => {
    if (visible && auth.currentUser) {
      loadNotes();
      loadSummary();
    }
  }, [visible, videoId]);

  const loadNotes = async () => {
    if (!auth.currentUser) return;
    
    try {
      setLoading(true);
      const note = await getNoteForVideo(auth.currentUser.uid, videoId);
      if (note) {
        setNotes({
          content: note.content,
          keyTakeaways: note.keyTakeaways || []
        });
        setReflections(note.reflections || {
          understanding: [],
          gaps: [],
          applications: [],
          connections: []
        });
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!auth.currentUser) return;
    
    try {
      setSaveStatus('saving');
      await saveNote(auth.currentUser.uid, videoId, notes.content, notes.keyTakeaways, reflections);
      setSaveStatus('success');
      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving notes:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleReflectionChange = (
    section: keyof Reflections,
    index: number,
    text: string
  ) => {
    setReflections(prev => ({
      ...prev,
      [section]: prev[section].map((item, i) => (i === index ? text : item))
    }));
  };

  const handleQuizSubmit = async () => {
    if (!auth.currentUser || !quiz) return;
    
    try {
      setLoading(true);
      // Calculate score
      const score = quiz.questions.reduce((total, _, index) => {
        return total + (quizAnswers[index] === quiz.questions[index].correctOptionIndex ? 1 : 0);
      }, 0);
      const scorePercentage = (score / quiz.questions.length) * 100;
      
      await saveQuizAttempt(
        auth.currentUser.uid,
        quiz.id,
        quizAnswers,
        scorePercentage,
        videoId,
        subjectId
      );
      setQuizScore(scorePercentage);
      setQuizSubmitted(true);
    } catch (error) {
      console.error('Error submitting quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const videoSummary = await VideoService.getSummary(videoId);
      setSummary(videoSummary || undefined);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const handleGenerateSummary = async () => {
    try {
      setGeneratingSummary(true);
      const videoSummary = await VideoService.generateSummary(videoId);
      setSummary(videoSummary || undefined);
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleAddTakeaway = () => {
    setNotes(prev => ({
      ...prev,
      keyTakeaways: [...prev.keyTakeaways, '']
    }));
  };

  const handleGenerateQuiz = async () => {
    try {
      setGeneratingQuiz(true);
      const newQuiz = await VideoService.generateQuiz(videoId);
      // Update the parent component's quiz state
      if (newQuiz) {
        onQuizGenerated?.(newQuiz);
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleGenerateFurtherReading = async () => {
    try {
      setLoading(true);
      const functions = getFunctions();
      const generateFurtherReading = httpsCallable(
        functions, 
        'generateFurtherReading',
        // Set a longer timeout for the function call
        { timeout: 300000 } // 5 minutes in milliseconds
      );

      const result = await generateFurtherReading({
        videoId,
        transcription,
        summary,
      });
      
      // Transform and validate the response data
      const recommendations = result.data as FurtherReading[];
      if (Array.isArray(recommendations) && recommendations.length > 0) {
        console.log('Received recommendations:', recommendations);
        onFurtherReadingGenerated?.(recommendations);
        Alert.alert('Success', 'Further reading recommendations have been generated.');
      } else {
        console.error('Invalid recommendations format:', result.data);
        Alert.alert('Error', 'Received invalid recommendations format');
      }
    } catch (error: any) {
      console.error('Error generating further reading:', error);
      // More specific error messages based on the error type
      if (error?.message?.includes('timeout')) {
        Alert.alert(
          'Request Timeout',
          'The request is taking longer than expected. The recommendations will appear when ready.'
        );
      } else {
        Alert.alert('Error', 'Failed to generate further reading recommendations');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderTab = (tab: Tab, label: string, icon: string) => {
    // Use shorter labels
    const shortLabel = {
      'transcription': 'Script',
      'summary': 'Summary',
      'notes': 'Notes',
      'quiz': 'Quiz',
      'reading': 'Reading'
    }[tab];

    return (
      <TouchableOpacity
        style={[styles.tab, activeTab === tab && styles.activeTab]}
        onPress={() => setActiveTab(tab)}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={icon as any} 
          size={22} // Reduced from 24
          color="#fff"
          style={[styles.tabIcon, activeTab === tab && styles.activeTabIcon]}
        />
        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]} numberOfLines={1}>
          {shortLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTranscriptionContent = () => {
    switch (transcriptionStatus) {
      case 'pending':
        return (
          <View style={styles.transcriptionLoading}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.transcriptionLoadingText}>Transcribing video...</Text>
          </View>
        );
      case 'error':
        return (
          <View style={styles.transcriptionError}>
            <Ionicons name="alert-circle" size={32} color="#ff4444" />
            <Text style={styles.transcriptionErrorText}>Failed to transcribe video</Text>
          </View>
        );
      case 'completed':
        if (video.transcriptionSegments) {
          return (
            <ScrollView style={styles.transcriptionContent}>
              {video.transcriptionSegments.map((segment: TranscriptionSegment, index: number) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.transcriptionSegment}
                  onPress={() => {
                    // TODO: Add seek functionality when video player controls are implemented
                  }}
                >
                  <Text style={styles.timestamp}>
                    {formatTime(segment.start)} - {formatTime(segment.end)}
                  </Text>
                  <Text style={styles.transcriptionText}>{segment.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          );
        } else if (video.transcription) {
          return (
            <ScrollView style={styles.transcriptionContent}>
              <View style={styles.plainTranscription}>
                <Text style={styles.transcriptionText}>{video.transcription}</Text>
              </View>
            </ScrollView>
          );
        }
        return (
          <View style={styles.transcriptionEmpty}>
            <Text style={styles.transcriptionEmptyText}>No transcription available</Text>
          </View>
        );
      default:
        return (
          <View style={styles.transcriptionEmpty}>
            <Text style={styles.transcriptionEmptyText}>No transcription available</Text>
          </View>
        );
    }
  };

  // Helper function to format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderReadingContent = () => (
    <View style={styles.tabContent}>
      {furtherReading ? (
        <ScrollView style={styles.scrollContent}>
          {furtherReading.map((resource, index) => (
            <View key={index} style={styles.resourceCard}>
              <Text style={styles.resourceTitle}>{resource.title}</Text>
              <Text style={styles.resourceAuthor}>by {resource.author}</Text>
              <Text style={styles.resourceDescription}>{resource.description}</Text>
            </View>
          ))}
        </ScrollView>
      ) : transcriptionStatus === 'completed' ? (
        <View style={styles.generateContainer}>
          <Text style={styles.generateText}>
            Generate reading recommendations based on the video content
          </Text>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateFurtherReading}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>
                Generate Recommendations
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color="#666" />
          <Text style={styles.waitingText}>
            Waiting for video transcription...
          </Text>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <ScrollView style={styles.content}>
            <VideoSummarySection
              summary={summary}
              isLoading={generatingSummary}
              onGenerateSummary={handleGenerateSummary}
            />
          </ScrollView>
        );
      case 'transcription':
        return renderTranscriptionContent();
      case 'notes':
        return renderNotesContent();
      case 'quiz':
        return renderQuizContent();
      case 'reading':
        return renderReadingContent();
    }
  };

  const renderNotesContent = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.sectionTitle}>Quick Capture</Text>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Capture your thoughts..."
            placeholderTextColor="#666"
            value={notes.content}
            onChangeText={text => setNotes(prev => ({ ...prev, content: text }))}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bulb-outline" size={20} color="#fff" />
          <Text style={styles.sectionTitle}>Key Takeaways</Text>
        </View>
        {notes.keyTakeaways.map((takeaway, index) => (
          <View key={index} style={styles.takeawayContainer}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={takeaway}
                onChangeText={text => {
                  const newTakeaways = [...notes.keyTakeaways];
                  newTakeaways[index] = text;
                  setNotes(prev => ({ ...prev, keyTakeaways: newTakeaways }));
                }}
                placeholder="Add a key takeaway..."
                placeholderTextColor="#666"
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => {
                  const newTakeaways = notes.keyTakeaways.filter((_, i) => i !== index);
                  setNotes(prev => ({ ...prev, keyTakeaways: newTakeaways }));
                }}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={handleAddTakeaway}>
          <Ionicons name="add-circle-outline" size={20} color="#666" style={styles.addIcon} />
          <Text style={styles.addButtonText}>Add Takeaway</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="telescope-outline" size={20} color="#fff" />
          <Text style={styles.sectionTitle}>Reflections</Text>
        </View>
        
        {Object.entries({
          understanding: {
            icon: 'school-outline',
            title: 'Understanding',
            subtitle: 'What are the main concepts you understand well?'
          },
          gaps: {
            icon: 'help-circle-outline',
            title: 'Knowledge Gaps',
            subtitle: 'What concepts need more clarification?'
          },
          applications: {
            icon: 'rocket-outline',
            title: 'Applications',
            subtitle: 'How can you apply these concepts?'
          },
          connections: {
            icon: 'git-network-outline',
            title: 'Connections',
            subtitle: 'How does this connect to other concepts?'
          }
        }).map(([key, config]) => (
          <View key={key} style={styles.reflectionSection}>
            <View style={styles.reflectionHeader}>
              <Ionicons name={config.icon as any} size={18} color="#999" />
              <View style={styles.reflectionTitleContainer}>
                <Text style={styles.reflectionTitle}>{config.title}</Text>
                <Text style={styles.reflectionSubtitle}>{config.subtitle}</Text>
              </View>
            </View>
            {reflections[key as keyof Reflections].map((item, index) => (
              <View key={index} style={styles.reflectionInputContainer}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={item}
                    onChangeText={text => handleReflectionChange(key as keyof Reflections, index, text)}
                    placeholder={`Add ${key}...`}
                    placeholderTextColor="#666"
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => {
                      const newReflections = reflections[key as keyof Reflections].filter((_, i) => i !== index);
                      setReflections(prev => ({ ...prev, [key]: newReflections }));
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setReflections(prev => ({
                ...prev,
                [key]: [...prev[key as keyof Reflections], '']
              }))}
            >
              <Ionicons name="add-circle-outline" size={20} color="#666" style={styles.addIcon} />
              <Text style={styles.addButtonText}>Add {config.title}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={[
          styles.saveButton,
          saveStatus === 'saving' && styles.saveButtonDisabled
        ]} 
        onPress={handleSaveNotes}
        disabled={saveStatus === 'saving'}
      >
        {saveStatus === 'saving' ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color="#fff" style={styles.saveIcon} />
            <Text style={styles.saveButtonText}>Save Notes</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderQuizContent = () => {
    if (generatingQuiz) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={[styles.emptyStateText, { marginTop: 20 }]}>
            Generating quiz...
          </Text>
        </View>
      );
    }

    if (!quiz) {
      if (transcriptionStatus !== 'completed') {
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Quiz generation will be available once the video transcription is complete.
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No quiz available for this video.</Text>
          <TouchableOpacity 
            style={styles.generateButton}
            onPress={handleGenerateQuiz}
          >
            <Text style={styles.generateButtonText}>Generate Quiz</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <QuizPanel
        quiz={quiz}
        videoId={videoId}
        subjectId={subjectId}
        onComplete={(score) => {
          // Update user progress when quiz is completed
          if (auth.currentUser) {
            saveQuizAttempt(
              auth.currentUser.uid,
              quiz.id,
              [],
              score,
              videoId,
              subjectId
            );
          }
        }}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={[styles.panel, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressTitle}>Learning Progress</Text>
              <Text style={styles.progressPercentage}>{getProgressPercentage()}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${getProgressPercentage()}%` }]} />
            </View>
          </View>

          <View style={styles.navigation}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.navContent}
            >
              {[
                { id: 'summary', icon: 'document-text-outline', label: 'Summary' },
                { id: 'transcription', icon: 'text-outline', label: 'Transcript' },
                { id: 'notes', icon: 'pencil-outline', label: 'Notes' },
                { id: 'quiz', icon: 'school-outline', label: 'Quiz' },
                { id: 'reading', icon: 'book-outline', label: 'Reading' }
              ].map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.navItem, activeTab === item.id && styles.activeNavItem]}
                  onPress={() => setActiveTab(item.id as Tab)}
                >
                  <Ionicons 
                    name={item.icon as any} 
                    size={18} 
                    color={activeTab === item.id ? '#9580FF' : '#999'} 
                    style={styles.navIcon}
                  />
                  <Text style={[
                    styles.navLabel,
                    activeTab === item.id && styles.activeNavLabel
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.content}>
            {renderContent()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  panel: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#111',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  progressSection: {
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercentage: {
    color: '#9580FF',
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#9580FF',
    borderRadius: 2,
  },
  navigation: {
    backgroundColor: '#1a1a1a',
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  navContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeNavItem: {
    backgroundColor: 'rgba(149, 128, 255, 0.15)',
  },
  navIcon: {
    marginRight: 6,
  },
  navLabel: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  activeNavLabel: {
    color: '#9580FF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: '#111',
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8, // Reduced from 12
    paddingHorizontal: 4, // Reduced from 8
    borderRadius: 8,
    backgroundColor: 'transparent',
    minWidth: 60,
  },
  activeTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabIcon: {
    marginBottom: 4, // Reduced from 6
    opacity: 0.6,
  },
  activeTabIcon: {
    opacity: 1,
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12, // Reduced from 13
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  contentText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 20,
  },
  notesInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  takeawayContainer: {
    marginBottom: 12,
  },
  takeawayInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  addIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
  },
  readingItem: {
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  readingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  readingDescription: {
    color: '#ccc',
    fontSize: 14,
  },
  question: {
    marginBottom: 24,
  },
  questionReview: {
    marginBottom: 32,
  },
  questionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  option: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: 'rgba(149, 128, 255, 0.15)',
    borderColor: '#9580FF',
    borderWidth: 1,
  },
  correctOption: {
    backgroundColor: 'rgba(26, 71, 42, 0.8)', // Keeping green but making it slightly transparent
  },
  incorrectOption: {
    backgroundColor: 'rgba(255, 68, 68, 0.8)', // Adding red with transparency for wrong answers
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
  },
  selectedOptionText: {
    color: '#9580FF',
    fontWeight: '600',
  },
  explanation: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  quizScore: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  reflectionSection: {
    marginBottom: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  reflectionTitleContainer: {
    flex: 1,
  },
  reflectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reflectionSubtitle: {
    color: '#999',
    fontSize: 14,
  },
  reflectionInputContainer: {
    marginBottom: 8,
  },
  removeButton: {
    position: 'absolute',
    right: 8,
    top: 10,
    padding: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9580FF',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  resourceCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resourceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  resourceAuthor: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  resourceDescription: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  generateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  generateText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  waitingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    flex: 1,
    minHeight: 40,
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  inputContainer: {
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  transcriptionContent: {
    flex: 1,
    padding: 15,
  },
  transcriptionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  transcriptionLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  transcriptionLoadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  transcriptionError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  transcriptionErrorText: {
    color: '#ff4444',
    fontSize: 16,
    marginTop: 10,
  },
  transcriptionEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  transcriptionEmptyText: {
    color: '#666',
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
  },
  generateButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  transcriptionSegment: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
  },
  timestamp: {
    color: '#9580FF',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.8,
  },
  plainTranscription: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
}); 