import { useLocalSearchParams, Stack, router } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { SUBJECT_DATA, MainSubject } from '../../../types/subject';
import { Video } from '../../../types/video';
import { VideoService } from '../../../services/firebase/video';
import VideoCard from '../../../components/VideoCard';
import { Ionicons } from '@expo/vector-icons';
import { QueryDocumentSnapshot } from 'firebase/firestore';

const { width, height: WINDOW_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 49;
const SCREEN_HEIGHT = WINDOW_HEIGHT - TAB_BAR_HEIGHT;

type Tab = 'overview' | 'learn' | 'progress' | 'practice';

export default function SubjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subject = SUBJECT_DATA[id as MainSubject];
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // Video feed state
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<any> | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (activeTab === 'learn') {
      loadVideos();
    }
  }, [activeTab]);

  const loadVideos = async (loadMore = false) => {
    try {
      if (loadMore && !lastVisible) return;

      setLoading(true);
      setError(undefined);
      
      const result = await VideoService.searchVideos(
        '', 
        { category: subject.name },
        { field: 'createdAt', direction: 'desc' },
        loadMore ? lastVisible : undefined
      );
      
      setVideos(prev => loadMore ? [...prev, ...result.videos] : result.videos);
      setLastVisible(result.lastVisible);
    } catch (error) {
      console.error('Error loading videos:', error);
      setError('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const onViewableItemsChanged = useCallback(({ 
    viewableItems 
  }: {
    viewableItems: ViewToken[];
    changed: ViewToken[];
  }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentVideoIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50
  };

  const renderOverviewContent = () => (
    <View style={styles.overviewSection}>
      <Text style={styles.description}>{subject.description}</Text>
      <Text style={styles.courseCount}>{subject.courseCount} courses</Text>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Videos Watched</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Quizzes Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0%</Text>
          <Text style={styles.statLabel}>Overall Progress</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.startLearningButton}
        onPress={() => setActiveTab('learn')}
      >
        <Text style={styles.startLearningText}>Start Learning</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLearnContent = () => {
    if (loading && !videos.length) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }

    if (error && !videos.length) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => loadVideos()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!videos.length) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No videos available</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={videos}
        renderItem={({ item, index }) => (
          <VideoCard video={item} isActive={index === currentVideoIndex} />
        )}
        keyExtractor={(item) => item.id}
        onEndReached={() => loadVideos(true)}
        onEndReachedThreshold={0.5}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        removeClippedSubviews={true}
        windowSize={3}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={100}
        initialNumToRender={2}
        ListFooterComponent={() =>
          loading ? (
            <View style={styles.footer}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null
        }
      />
    );
  };

  const renderProgressContent = () => (
    <View style={styles.comingSoonContainer}>
      <Text style={styles.comingSoonText}>Progress tracking coming soon!</Text>
    </View>
  );

  const renderPracticeContent = () => (
    <View style={styles.comingSoonContainer}>
      <Text style={styles.comingSoonText}>Quizzes coming soon!</Text>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewContent();
      case 'learn':
        return renderLearnContent();
      case 'progress':
        return renderProgressContent();
      case 'practice':
        return renderPracticeContent();
    }
  };

  const renderBottomTabs = () => (
    <View style={styles.bottomTabs}>
      <TouchableOpacity 
        style={styles.bottomTab}
        onPress={() => router.push('/(app)/(tabs)')}
      >
        <Ionicons name="home-outline" size={24} color="#666" />
        <Text style={styles.bottomTabText}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.bottomTab}
        onPress={() => router.push('/(app)/(tabs)/search')}
      >
        <Ionicons name="search-outline" size={24} color="#666" />
        <Text style={styles.bottomTabText}>Search</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.bottomTab}
        onPress={() => router.push('/(app)/(tabs)/profile')}
      >
        <Ionicons name="person-outline" size={24} color="#666" />
        <Text style={styles.bottomTabText}>Profile</Text>
      </TouchableOpacity>
    </View>
  );

  if (!subject) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Subject not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: subject.name,
          headerStyle: {
            backgroundColor: subject.color,
          },
          headerTintColor: '#fff',
          headerShadowVisible: false,
        }}
      />
      
      <View style={styles.content}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'learn' && styles.activeTab]}
            onPress={() => setActiveTab('learn')}
          >
            <Text style={[styles.tabText, activeTab === 'learn' && styles.activeTabText]}>
              Learn
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
            onPress={() => setActiveTab('progress')}
          >
            <Text style={[styles.tabText, activeTab === 'progress' && styles.activeTabText]}>
              Progress
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'practice' && styles.activeTab]}
            onPress={() => setActiveTab('practice')}
          >
            <Text style={[styles.tabText, activeTab === 'practice' && styles.activeTabText]}>
              Practice
            </Text>
          </TouchableOpacity>
        </View>
        
        {renderContent()}
      </View>
      
      {renderBottomTabs()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#000',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  overviewSection: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  courseCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
  },
  startLearningButton: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startLearningText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 5,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
  footer: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomTabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#000',
    paddingBottom: 20,
    paddingTop: 10,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  comingSoonText: {
    color: '#666',
    fontSize: 16,
  },
}); 