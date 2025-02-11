import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Subject } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { auth } from '../../../services/firebase';
import { LinearGradient } from 'expo-linear-gradient';

// Map subject names to appropriate icons and colors
const getSubjectConfig = (name: string): { icon: string; gradient: [string, string] } => {
  const nameLower = name.toLowerCase();
  const configs = {
    math: {
      icon: 'calculator-outline',
      gradient: ['#9580FF', '#80FFEA'] as [string, string],
    },
    science: {
      icon: 'flask-outline',
      gradient: ['#9580FF', '#FF80BF'] as [string, string],
    },
    history: {
      icon: 'time-outline',
      gradient: ['#9580FF', '#8AFF80'] as [string, string],
    },
    language: {
      icon: 'language-outline',
      gradient: ['#9580FF', '#FF9580'] as [string, string],
    },
    art: {
      icon: 'color-palette-outline',
      gradient: ['#9580FF', '#80FFD4'] as [string, string],
    },
    music: {
      icon: 'musical-notes-outline',
      gradient: ['#9580FF', '#FF80E5'] as [string, string],
    },
    computer: {
      icon: 'desktop-outline',
      gradient: ['#9580FF', '#80FFA3'] as [string, string],
    },
    physics: {
      icon: 'rocket-outline',
      gradient: ['#9580FF', '#80C7FF'] as [string, string],
    },
    chemistry: {
      icon: 'beaker-outline',
      gradient: ['#9580FF', '#FFCF80'] as [string, string],
    },
    biology: {
      icon: 'leaf-outline',
      gradient: ['#9580FF', '#80FFB1'] as [string, string],
    },
    psychology: {
      icon: 'school-outline',
      gradient: ['#9580FF', '#FF80B1'] as [string, string],
    },
    economics: {
      icon: 'cash-outline',
      gradient: ['#9580FF', '#80FFCB'] as [string, string],
    },
    data: {
      icon: 'bar-chart-outline',
      gradient: ['#9580FF', '#80DBFF'] as [string, string],
    },
    network: {
      icon: 'git-network-outline',
      gradient: ['#9580FF', '#80FFF9'] as [string, string],
    },
    design: {
      icon: 'color-wand-outline',
      gradient: ['#9580FF', '#FF80DD'] as [string, string],
    },
  };

  for (const [key, config] of Object.entries(configs)) {
    if (nameLower.includes(key)) {
      return config;
    }
  }

  return {
    icon: 'book-outline',
    gradient: ['#9580FF', '#80FFE5'] as [string, string],
  };
};

const getRandomDelay = () => Math.random() * 2000;
const getRandomDuration = () => 3000 + Math.random() * 2000;

export default function SubjectsScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  // Create animation values for each subject
  const animations = subjects.map(() => ({
    translateY: new Animated.Value(0),
    rotation: new Animated.Value(0)
  }));

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    // Start animations for each subject
    subjects.forEach((_, index) => {
      const startAnimation = () => {
        const duration = getRandomDuration();
        Animated.parallel([
          Animated.sequence([
            Animated.timing(animations[index].translateY, {
              toValue: -8,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(animations[index].translateY, {
              toValue: 0,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            })
          ]),
          Animated.sequence([
            Animated.timing(animations[index].rotation, {
              toValue: 1,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(animations[index].rotation, {
              toValue: 0,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            })
          ])
        ]).start(() => startAnimation());
      };

      setTimeout(startAnimation, getRandomDelay());
    });
  }, [subjects.length]);

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

  const renderSubjectCard = (subject: Subject, index: number) => {
    const config = getSubjectConfig(subject.name);
    const animatedStyle = {
      transform: [
        { translateY: animations[index]?.translateY || new Animated.Value(0) },
        {
          rotate: animations[index]?.rotation.interpolate({
            inputRange: [0, 1],
            outputRange: ['-1deg', '1deg']
          }) || '0deg'
        }
      ]
    };

    return (
      <Animated.View key={subject.id} style={[styles.cardWrapper, animatedStyle]}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleSubjectPress(subject.id)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={config.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={config.icon as any}
                  size={32}
                  color="#fff"
                />
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {subject.name}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#9580FF" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSubjects}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {subjects.map((subject, index) => renderSubjectCard(subject, index))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const COLUMNS = 2;
const SPACING = 20;
const HORIZONTAL_PADDING = 20;
const itemWidth = (width - (HORIZONTAL_PADDING * 2) - (SPACING * (COLUMNS - 1))) / COLUMNS;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    padding: HORIZONTAL_PADDING,
    paddingBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING,
    paddingTop: 8,
  },
  cardWrapper: {
    width: itemWidth,
    aspectRatio: 1,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: itemWidth / 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#9580FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardGradient: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  retryButton: {
    backgroundColor: '#9580FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 