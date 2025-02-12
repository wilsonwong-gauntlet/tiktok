import React, { useEffect, useState, useRef, useCallback } from 'react';
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

const TIMING = {
  FADE_IN_DURATION: 1000,
  FADE_OUT_DURATION: 1000,
  DISPLAY_DURATION: 10000,
  APPEAR_BEFORE: 1, // Start showing 1s before timestamp
  STAY_AFTER: 10, // Keep showing for 10s after timestamp
};

export default function CoachingPrompts({
  prompts,
  currentTime,
  onGeneratePrompts,
  isGenerating = false,
}: CoachingPromptsProps) {
  const [activePrompt, setActivePrompt] = useState<CoachingPrompt | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeOutTimer = useRef<NodeJS.Timeout>();
  const isAnimating = useRef(false);

  const showPrompt = useCallback((prompt: CoachingPrompt) => {
    // Clear any existing fade out timer
    if (fadeOutTimer.current) {
      clearTimeout(fadeOutTimer.current);
    }

    setActivePrompt(prompt);
    isAnimating.current = true;

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: TIMING.FADE_IN_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
    });
  }, []);

  const hidePrompt = useCallback(() => {
    if (isAnimating.current) return;

    isAnimating.current = true;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: TIMING.FADE_OUT_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
      setActivePrompt(null);
    });
  }, []);

  // Handle prompt timing
  useEffect(() => {
    if (!prompts.length) return;

    // Find the next prompt that should be shown
    const nextPrompt = prompts.find(prompt => {
      const timeDiff = currentTime - prompt.timestamp;
      // Show prompt if we're within the window before timestamp
      // and keep showing it for STAY_AFTER seconds after timestamp
      return timeDiff >= -TIMING.APPEAR_BEFORE && timeDiff <= TIMING.STAY_AFTER;
    });

    if (nextPrompt) {
      // Only show if it's a different prompt or we're not currently showing one
      if (!activePrompt || nextPrompt.timestamp !== activePrompt.timestamp) {
        showPrompt(nextPrompt);
      }
    } else if (activePrompt) {
      // If we have an active prompt but no next prompt, check if we should hide it
      const timeSincePrompt = currentTime - activePrompt.timestamp;
      if (timeSincePrompt < -TIMING.APPEAR_BEFORE || timeSincePrompt > TIMING.STAY_AFTER) {
        hidePrompt();
      }
    }
  }, [currentTime, prompts, activePrompt, showPrompt, hidePrompt]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (fadeOutTimer.current) {
        clearTimeout(fadeOutTimer.current);
      }
    };
  }, []);

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

  if (!activePrompt) return null;

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
                activePrompt.type === 'reflection' ? 'bulb-outline' :
                activePrompt.type === 'action' ? 'checkmark-circle-outline' :
                'git-branch-outline'
              }
              size={20}
              color="#fff"
            />
          </View>
          <Text style={styles.promptText}>{activePrompt.text}</Text>
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