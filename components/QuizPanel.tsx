import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Quiz, QuizAttempt } from '../types/video';
import { auth, db } from '../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { saveQuizAttempt } from '../services/firebase/learning';

interface QuizPanelProps {
  quiz: Quiz;
  videoId: string;
  subjectId: string;
  onComplete?: (score: number) => void;
}

export default function QuizPanel({ quiz, videoId, subjectId, onComplete }: QuizPanelProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [previousAttempt, setPreviousAttempt] = useState<QuizAttempt | null>(null);

  useEffect(() => {
    loadPreviousAttempt();
  }, []);

  const loadPreviousAttempt = async () => {
    if (!auth.currentUser) return;

    try {
      const attemptRef = doc(db, 'users', auth.currentUser.uid, 'quizAttempts', quiz.id);
      const attemptDoc = await getDoc(attemptRef);
      
      if (attemptDoc.exists()) {
        setPreviousAttempt(attemptDoc.data() as QuizAttempt);
      }
    } catch (error) {
      console.error('Error loading previous attempt:', error);
    }
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (quizCompleted) return;
    setSelectedOption(optionIndex);
  };

  const handleNext = async () => {
    if (selectedOption === null) return;

    const newAnswers = [...answers, selectedOption];
    setAnswers(newAnswers);

    if (currentQuestionIndex === quiz.questions.length - 1) {
      // Calculate score
      const correctAnswers = newAnswers.reduce((count, answer, index) => {
        return count + (answer === quiz.questions[index].correctOptionIndex ? 1 : 0);
      }, 0);
      const finalScore = (correctAnswers / quiz.questions.length) * 100;
      
      setScore(finalScore);
      setQuizCompleted(true);
      onComplete?.(finalScore);

      // Save attempt if user is logged in
      if (auth.currentUser) {
        try {
          await saveQuizAttempt(
            auth.currentUser.uid,
            quiz.id,
            newAnswers,
            finalScore,
            videoId,
            subjectId
          );
          // Refresh learning data after saving quiz attempt
          if (typeof window !== 'undefined' && (window as any).refreshLearningData) {
            (window as any).refreshLearningData();
          }
        } catch (error) {
          console.error('Error saving quiz attempt:', error);
        }
      }
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    }
  };

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isCorrect = selectedOption === currentQuestion.correctOptionIndex;

  if (quizCompleted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Quiz Complete!</Text>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>Your Score</Text>
          <Text style={styles.score}>{Math.round(score)}%</Text>
          {previousAttempt && previousAttempt.score < score && (
            <View style={styles.improvement}>
              <Ionicons name="trending-up" size={20} color="#4CAF50" />
              <Text style={styles.improvementText}>
                +{Math.round(score - previousAttempt.score)}% improvement!
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setCurrentQuestionIndex(0);
            setSelectedOption(null);
            setShowExplanation(false);
            setAnswers([]);
            setQuizCompleted(false);
            setScore(0);
          }}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.progress}>
        <Text style={styles.progressText}>
          Question {currentQuestionIndex + 1} of {quiz.questions.length}
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      <Text style={styles.question}>{currentQuestion.question}</Text>

      <View style={styles.options}>
        {currentQuestion.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.option,
              selectedOption === index && styles.selectedOption,
              showExplanation && index === currentQuestion.correctOptionIndex && styles.correctOption,
              showExplanation && selectedOption === index && selectedOption !== currentQuestion.correctOptionIndex && styles.incorrectOption
            ]}
            onPress={() => handleOptionSelect(index)}
            disabled={showExplanation}
          >
            <Text style={[
              styles.optionText,
              selectedOption === index && styles.selectedOptionText
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedOption !== null && !showExplanation && (
        <TouchableOpacity 
          style={styles.checkButton}
          onPress={() => setShowExplanation(true)}
        >
          <Text style={styles.checkButtonText}>Check Answer</Text>
        </TouchableOpacity>
      )}

      {showExplanation && (
        <View style={styles.explanation}>
          <Text style={[styles.result, isCorrect ? styles.correct : styles.incorrect]}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </Text>
          <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
          <TouchableOpacity 
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {currentQuestionIndex === quiz.questions.length - 1 ? 'Finish' : 'Next Question'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  progress: {
    padding: 20,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9580FF',
    borderRadius: 2,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    padding: 20,
    paddingTop: 0,
  },
  options: {
    padding: 20,
    gap: 12,
  },
  option: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedOption: {
    borderColor: '#9580FF',
    backgroundColor: 'rgba(149, 128, 255, 0.15)',
  },
  correctOption: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  incorrectOption: {
    borderColor: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
  },
  selectedOptionText: {
    color: '#9580FF',
    fontWeight: '600',
  },
  checkButton: {
    backgroundColor: '#9580FF',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  explanation: {
    padding: 20,
    backgroundColor: '#222',
    margin: 20,
    borderRadius: 8,
  },
  result: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  correct: {
    color: '#4CAF50',
  },
  incorrect: {
    color: '#f44336',
  },
  explanationText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  nextButton: {
    backgroundColor: '#9580FF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  scoreContainer: {
    alignItems: 'center',
    padding: 20,
  },
  scoreText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
  },
  score: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#9580FF',
  },
  improvement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  improvementText: {
    color: '#4CAF50',
    fontSize: 16,
    marginLeft: 4,
  },
  retryButton: {
    backgroundColor: '#9580FF',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 