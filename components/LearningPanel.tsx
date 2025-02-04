import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FurtherReading } from '../types/video';
import { saveNote, getNoteForVideo, saveQuizAttempt } from '../services/firebase/learning';
import { auth } from '../services/firebase/index';
import { Note, Quiz } from '../types/video';

interface LearningPanelProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  videoId: string;
  aiSummary?: string;
  furtherReading?: FurtherReading[];
  quiz?: Quiz;
}

type Tab = 'summary' | 'notes' | 'quiz' | 'reading';

export default function LearningPanel({
  visible,
  onClose,
  title,
  videoId,
  aiSummary,
  furtherReading,
  quiz,
}: LearningPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [notes, setNotes] = useState('');
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && auth.currentUser) {
      loadNotes();
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
      setLoading(true);
      await saveNote(auth.currentUser.uid, videoId, notes, keyTakeaways);
      // Show success feedback
    } catch (error) {
      console.error('Error saving notes:', error);
      // Show error feedback
    } finally {
      setLoading(false);
    }
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

  const renderContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <ScrollView style={styles.content}>
            <Text style={styles.contentText}>{aiSummary}</Text>
          </ScrollView>
        );
      case 'notes':
        return (
          <ScrollView style={styles.content}>
            <Text style={styles.label}>My Notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              placeholder="Write your thoughts..."
              placeholderTextColor="#666"
              value={notes}
              onChangeText={setNotes}
            />
            <Text style={styles.label}>Key Takeaways</Text>
            {keyTakeaways.map((takeaway, index) => (
              <View key={index} style={styles.takeawayContainer}>
                <Text style={styles.takeawayText}>{takeaway}</Text>
              </View>
            ))}
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setKeyTakeaways([...keyTakeaways, ''])}
            >
              <Text style={styles.addButtonText}>+ Add Takeaway</Text>
            </TouchableOpacity>
          </ScrollView>
        );
      case 'quiz':
        return renderQuizContent();
      case 'reading':
        return (
          <ScrollView style={styles.content}>
            {furtherReading?.map((item, index) => (
              <View key={index} style={styles.readingItem}>
                <Text style={styles.readingTitle}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.readingDescription}>{item.description}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        );
    }
  };

  const renderQuizContent = () => {
    if (!quiz) return <Text style={styles.contentText}>No quiz available for this video.</Text>;
    
    if (quizSubmitted) {
      return (
        <ScrollView style={styles.content}>
          <Text style={styles.quizScore}>Your Score: {quizScore}%</Text>
          {quiz.questions.map((question, index) => (
            <View key={index} style={styles.questionReview}>
              <Text style={styles.questionText}>{question.question}</Text>
              {question.options.map((option, optionIndex) => (
                <View 
                  key={optionIndex} 
                  style={[
                    styles.option,
                    quizAnswers[index] === optionIndex && styles.selectedOption,
                    optionIndex === question.correctOptionIndex && styles.correctOption,
                  ]}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </View>
              ))}
              <Text style={styles.explanation}>{question.explanation}</Text>
            </View>
          ))}
          <TouchableOpacity 
            style={styles.button}
            onPress={() => {
              setQuizSubmitted(false);
              setQuizAnswers([]);
            }}
          >
            <Text style={styles.buttonText}>Retake Quiz</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.content}>
        {quiz.questions.map((question, index) => (
          <View key={index} style={styles.question}>
            <Text style={styles.questionText}>{question.question}</Text>
            {question.options.map((option, optionIndex) => (
              <TouchableOpacity
                key={optionIndex}
                style={[
                  styles.option,
                  quizAnswers[index] === optionIndex && styles.selectedOption,
                ]}
                onPress={() => {
                  const newAnswers = [...quizAnswers];
                  newAnswers[index] = optionIndex;
                  setQuizAnswers(newAnswers);
                }}
              >
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <TouchableOpacity 
          style={[
            styles.button,
            quizAnswers.length !== quiz.questions.length && styles.buttonDisabled
          ]}
          disabled={quizAnswers.length !== quiz.questions.length}
          onPress={handleQuizSubmit}
        >
          <Text style={styles.buttonText}>Submit Quiz</Text>
        </TouchableOpacity>
      </ScrollView>
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
            {renderTab('notes', 'Notes', 'pencil-outline')}
            {renderTab('quiz', 'Quiz', 'school-outline')}
            {renderTab('reading', 'Reading', 'book-outline')}
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
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  takeawayText: {
    color: '#fff',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
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
}); 