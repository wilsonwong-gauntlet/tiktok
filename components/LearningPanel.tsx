import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FurtherReading, VideoSummary } from '../types/video';
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
  summary?: VideoSummary;
  furtherReading?: FurtherReading[];
  quiz?: Quiz;
  transcription?: string;
  transcriptionStatus?: 'pending' | 'completed' | 'error';
  onQuizGenerated?: (quiz: Quiz) => void;
  onFurtherReadingGenerated?: (reading: FurtherReading[]) => void;
}

type Tab = 'summary' | 'notes' | 'quiz' | 'reading' | 'intuition' | 'transcription';

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
  summary: initialSummary,
  furtherReading,
  quiz,
  transcription,
  transcriptionStatus,
  onQuizGenerated,
  onFurtherReadingGenerated,
}: LearningPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [notes, setNotes] = useState('');
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>(['']);
  const [reflections, setReflections] = useState<{
    understanding: string[];
    gaps: string[];
    applications: string[];
    connections: string[];
  }>({
    understanding: ['', '', ''],
    gaps: ['', '', ''],
    applications: ['', '', ''],
    connections: ['', '', ''],
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
        setNotes(note.content);
        setKeyTakeaways(note.keyTakeaways);
        if (note.reflections) {
          setReflections(note.reflections);
        }
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
      await saveNote(auth.currentUser.uid, videoId, notes, keyTakeaways, reflections);
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
    section: keyof typeof reflections,
    index: number,
    value: string
  ) => {
    setReflections(prev => ({
      ...prev,
      [section]: prev[section].map((item, i) => i === index ? value : item)
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
      
      await saveQuizAttempt(auth.currentUser.uid, quiz.id, quizAnswers, scorePercentage);
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
    setKeyTakeaways([...keyTakeaways, '']);
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

  const renderTab = (tab: Tab, label: string, icon: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons 
        name={icon as any} 
        size={24} 
        color={activeTab === tab ? '#fff' : '#666'} 
      />
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

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
        return transcription ? (
          <ScrollView style={styles.transcriptionContent}>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </ScrollView>
        ) : (
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
      case 'intuition':
        return (
          <ScrollView style={styles.content}>
            <View style={styles.intuitionSection}>
              <Text style={styles.sectionTitle}>Mental Models</Text>
              <Text style={styles.promptText}>
                How would you explain this concept to a:
              </Text>
              <TextInput
                style={styles.reflectionInput}
                multiline
                placeholder="5-year-old child..."
                placeholderTextColor="#666"
              />
              <TextInput
                style={styles.reflectionInput}
                multiline
                placeholder="High school student..."
                placeholderTextColor="#666"
              />
              <TextInput
                style={styles.reflectionInput}
                multiline
                placeholder="Expert in a different field..."
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.intuitionSection}>
              <Text style={styles.sectionTitle}>Visual Understanding</Text>
              <Text style={styles.promptText}>
                Draw or describe a visual metaphor for this concept:
              </Text>
              <TextInput
                style={styles.reflectionInput}
                multiline
                placeholder="Describe your visual metaphor..."
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.intuitionSection}>
              <Text style={styles.sectionTitle}>Pattern Recognition</Text>
              <Text style={styles.promptText}>
                What patterns or principles do you notice?
              </Text>
              <TextInput
                style={styles.reflectionInput}
                multiline
                placeholder="Describe the patterns you see..."
                placeholderTextColor="#666"
              />
              <Text style={styles.promptText}>
                Where else have you seen similar patterns?
              </Text>
              <TextInput
                style={styles.reflectionInput}
                multiline
                placeholder="List similar patterns in other contexts..."
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.intuitionSection}>
              <Text style={styles.sectionTitle}>Edge Cases</Text>
              <Text style={styles.promptText}>
                When might this concept break down or not apply?
              </Text>
              <TextInput
                style={styles.reflectionInput}
                multiline
                placeholder="Describe edge cases and limitations..."
                placeholderTextColor="#666"
              />
            </View>
          </ScrollView>
        );
    }
  };

  const renderNotesContent = () => (
    <ScrollView style={styles.content}>
      <Text style={styles.label}>Quick Capture</Text>
      <TextInput
        style={styles.notesInput}
        multiline
        placeholder="Write your immediate thoughts..."
        placeholderTextColor="#666"
        value={notes}
        onChangeText={setNotes}
      />
      
      <Text style={styles.sectionTitle}>Structured Reflection</Text>
      {Object.entries(REFLECTION_TEMPLATE).map(([section, prompts]) => (
        <View key={section} style={styles.reflectionSection}>
          <Text style={styles.reflectionTitle}>
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </Text>
          {prompts.map((prompt, index) => (
            <View key={index} style={styles.promptContainer}>
              <Text style={styles.promptText}>{prompt}</Text>
              <TextInput
                style={styles.reflectionInput}
                multiline
                placeholder="Your thoughts..."
                placeholderTextColor="#666"
                value={reflections[section as keyof typeof reflections][index]}
                onChangeText={(text) => handleReflectionChange(section as keyof typeof reflections, index, text)}
              />
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.label}>Key Takeaways</Text>
      {keyTakeaways.map((takeaway, index) => (
        <View key={index} style={styles.takeawayContainer}>
          <TextInput
            style={styles.takeawayInput}
            multiline
            value={takeaway}
            onChangeText={(text) => {
              const newTakeaways = [...keyTakeaways];
              newTakeaways[index] = text;
              setKeyTakeaways(newTakeaways);
            }}
            placeholder="Enter a key takeaway..."
            placeholderTextColor="#666"
          />
        </View>
      ))}
      
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={handleAddTakeaway}
      >
        <Text style={styles.addButtonText}>+ Add Takeaway</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[
          styles.button,
          saveStatus === 'saving' && styles.buttonDisabled
        ]}
        onPress={handleSaveNotes}
        disabled={saveStatus === 'saving'}
      >
        <Text style={styles.buttonText}>
          {saveStatus === 'saving' ? 'Saving...' : 'Save Reflection'}
        </Text>
      </TouchableOpacity>

      {saveStatus === 'success' && (
        <Text style={styles.successText}>✓ Saved successfully</Text>
      )}
      {saveStatus === 'error' && (
        <Text style={styles.errorText}>⚠ Error saving reflection</Text>
      )}
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
        onComplete={(score) => {
          // Update user progress when quiz is completed
          if (auth.currentUser) {
            saveQuizAttempt(auth.currentUser.uid, quiz.id, [], score);
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
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {renderTab('summary', 'Summary', 'document-text-outline')}
            {renderTab('transcription', 'Transcript', 'text-outline')}
            {renderTab('notes', 'Notes', 'pencil-outline')}
            {renderTab('quiz', 'Quiz', 'school-outline')}
            {renderTab('reading', 'Reading', 'book-outline')}
            {renderTab('intuition', 'Intuition', 'bulb-outline')}
          </View>

          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '70%',
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    opacity: 0.7,
  },
  activeTab: {
    opacity: 1,
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
  },
  tabText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
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
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
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
    backgroundColor: '#333',
    borderColor: '#666',
    borderWidth: 1,
  },
  correctOption: {
    backgroundColor: '#1a472a',
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
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
  },
  reflectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  promptContainer: {
    marginBottom: 16,
  },
  promptText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  reflectionInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    color: '#333',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  intuitionSection: {
    marginBottom: 20,
  },
  successText: {
    color: '#1a472a',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
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
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
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
}); 