import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { CoachingPrompt } from '../types/video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const dismissTimeout = useRef<NodeJS.Timeout>();

  // Simplified timing constants
  const PROMPT_WINDOW = 3; // Show prompts within 3 seconds of timestamp
  const ANIMATION_DURATION = 1000; // 1 second for all animations
  const VISIBILITY_DURATION = 5000; // Show for 5 seconds

  useEffect(() => {
    // Find prompt that matches current time
    const activePrompt = prompts.find(prompt => {
      const timeDiff = Math.abs(prompt.timestamp - currentTime);
      return timeDiff <= PROMPT_WINDOW;
    });

    // Handle prompt changes
    if (activePrompt !== currentPrompt) {
      // Clear any existing timeout
      if (dismissTimeout.current) {
        clearTimeout(dismissTimeout.current);
      }

      if (activePrompt) {
        // Show new prompt
        setCurrentPrompt(activePrompt);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }).start();

        // Set dismiss timeout
        dismissTimeout.current = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: ANIMATION_DURATION,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }).start(() => setCurrentPrompt(null));
        }, VISIBILITY_DURATION);
      } else {
        // Fade out current prompt
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }).start(() => setCurrentPrompt(null));
      }
    }

    return () => {
      if (dismissTimeout.current) {
        clearTimeout(dismissTimeout.current);
      }
    };
  }, [currentTime, prompts]);

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

  if (!currentPrompt) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
              extrapolate: 'clamp',
            }),
          }],
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0.85)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.promptContainer}
      >
        <View style={styles.promptContent}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={
                currentPrompt.type === 'reflection' ? 'bulb-outline' :
                currentPrompt.type === 'action' ? 'checkmark-circle-outline' :
                'git-branch-outline'
              } 
              size={20}
              color="#fff" 
            />
          </View>
          <Text style={styles.promptText}>{currentPrompt.text}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  promptContainer: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  promptContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  promptText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  generateButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
}); 