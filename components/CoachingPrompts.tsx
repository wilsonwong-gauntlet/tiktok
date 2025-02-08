import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { CoachingPrompt } from '../types/video';
import { Ionicons } from '@expo/vector-icons';

interface CoachingPromptsProps {
  prompts: CoachingPrompt[];
  currentTime: number;
  onGeneratePrompts?: () => Promise<void>;
  isGenerating?: boolean;
}

export default function CoachingPrompts({ 
  prompts, 
  currentTime, 
  onGeneratePrompts,
  isGenerating = false 
}: CoachingPromptsProps) {
  const [currentPrompt, setCurrentPrompt] = useState<CoachingPrompt | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Reset dismissed state when time changes significantly
    setIsDismissed(false);
  }, [Math.floor(currentTime / 30)]); // Reset every 30 seconds

  useEffect(() => {
    if (isDismissed) return;

    // Find the most relevant prompt for the current time
    const relevantPrompt = prompts.find(prompt => {
      const timeDiff = Math.abs(prompt.timestamp - currentTime);
      // Show prompt if we're within 2 seconds of its timestamp
      return timeDiff <= 2;
    });

    if (relevantPrompt !== currentPrompt) {
      if (relevantPrompt) {
        setCurrentPrompt(relevantPrompt);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } else {
        // Fade out
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setCurrentPrompt(null);
        });
      }
    }
  }, [currentTime, prompts, isDismissed]);

  if (isGenerating) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Generating coaching prompts...</Text>
        </View>
      </View>
    );
  }

  if (!prompts.length && onGeneratePrompts) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.generateButton} 
          onPress={onGeneratePrompts}
        >
          <Text style={styles.generateButtonText}>Generate Coaching Prompts</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentPrompt || isDismissed) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            }),
          }],
        },
      ]}
    >
      <View style={styles.promptContainer}>
        <View style={styles.promptContent}>
          <Ionicons 
            name={
              currentPrompt.type === 'reflection' ? 'bulb-outline' :
              currentPrompt.type === 'action' ? 'checkmark-circle-outline' :
              'git-branch-outline'  // for 'connection' type
            } 
            size={24} 
            color="#fff" 
          />
          <Text style={styles.promptText}>{currentPrompt.text}</Text>
        </View>
        <TouchableOpacity 
          style={styles.dismissButton}
          onPress={() => setIsDismissed(true)}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 1000,
  },
  promptContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  promptContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  promptText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  dismissButton: {
    padding: 4,
  },
  generateButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
}); 