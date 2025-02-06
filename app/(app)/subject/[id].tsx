import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Subject, Concept, Video, VideoSummary } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { VideoService } from '../../../services/firebase/video';
import { auth } from '../../../services/firebase';
import VideoThumbnail from '../../../components/VideoThumbnail';
import { collection, doc, getDoc } from 'firebase/firestore';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

type TabType = 'overview' | 'summaries' | 'quizzes' | 'reflections';

type FilterOptions = {
  searchQuery: string;
  sortBy: 'date' | 'title' | 'views';
  sortOrder: 'asc' | 'desc';
  conceptFilter: string[];
};

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [summaries, setSummaries] = useState<{[key: string]: VideoSummary}>({});
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    searchQuery: '',
    sortBy: 'date',
    sortOrder: 'desc',
    conceptFilter: []
  });
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [filteredSavedVideos, setFilteredSavedVideos] = useState<Video[]>([]);

  useEffect(() => {
    loadSubjectAndVideos();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'summaries' && videos.length > 0 && Object.keys(summaries).length === 0) {
      loadAllSummaries();
    }
  }, [activeTab, videos]);

  useEffect(() => {
    filterContent();
  }, [filterOptions, videos, savedVideos]);

  const loadAllSummaries = async () => {
    try {
      setLoadingSummaries(true);
      const summaryPromises = videos.map(video => VideoService.getSummary(video.id));
      const summaryResults = await Promise.all(summaryPromises);
      
      const summaryMap = videos.reduce((acc, video, index) => {
        if (summaryResults[index]) {
          acc[video.id] = summaryResults[index]!;
        }
        return acc;
      }, {} as {[key: string]: VideoSummary});
      
      setSummaries(summaryMap);
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoadingSummaries(false);
    }
  };

  const loadSubjectAndVideos = async () => {
    if (!auth.currentUser || !id) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading subject and videos for:', {
        subjectId: id,
        userId: auth.currentUser.uid
      });

      // Load subject data
      const subjectData = await SubjectService.getSubjectById(id as string, auth.currentUser.uid);
      if (!subjectData) {
        setError('Subject not found');
        return;
      }
      console.log('Loaded subject:', subjectData);
      setSubject(subjectData);

      // Load all related videos
      const subjectVideos = await VideoService.getVideosBySubject(id as string);
      console.log('Loaded subject videos:', subjectVideos);
      setVideos(subjectVideos);

      // Load saved videos for this subject
      const savedVideoIds = await VideoService.getSavedVideoIds(auth.currentUser.uid);
      console.log('Loaded saved video IDs:', savedVideoIds);
      
      const savedSubjectVideos = subjectVideos.filter(video => savedVideoIds.includes(video.id));
      console.log('Filtered saved subject videos:', savedSubjectVideos);
      setSavedVideos(savedSubjectVideos);

    } catch (error) {
      console.error('Error loading subject:', error);
      setError('Failed to load subject');
    } finally {
      setLoading(false);
    }
  };

  const filterContent = () => {
    const filterVideos = (videoList: Video[]) => {
      return videoList.filter(video => {
        // Search query filter
        const matchesSearch = filterOptions.searchQuery === '' ||
          video.title.toLowerCase().includes(filterOptions.searchQuery.toLowerCase()) ||
          video.description.toLowerCase().includes(filterOptions.searchQuery.toLowerCase());

        // Concept filter
        const matchesConcepts = filterOptions.conceptFilter.length === 0 ||
          video.conceptIds.some(id => filterOptions.conceptFilter.includes(id));

        return matchesSearch && matchesConcepts;
      }).sort((a, b) => {
        // Sort based on selected option
        switch (filterOptions.sortBy) {
          case 'date':
            return filterOptions.sortOrder === 'desc' 
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime();
          case 'title':
            return filterOptions.sortOrder === 'desc'
              ? b.title.localeCompare(a.title)
              : a.title.localeCompare(b.title);
          case 'views':
            return filterOptions.sortOrder === 'desc'
              ? b.viewCount - a.viewCount
              : a.viewCount - b.viewCount;
          default:
            return 0;
        }
      });
    };

    setFilteredVideos(filterVideos(videos));
    setFilteredSavedVideos(filterVideos(savedVideos));
  };

  const renderProgressBar = (progress: number) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
    </View>
  );

  const renderConcept = (concept: Concept) => {
    const getStatusColor = () => {
      switch (concept.status) {
        case 'mastered':
          return '#2E7D32';
        case 'in_progress':
          return '#F57F17';
        default:
          return '#666';
      }
    };

    return (
      <TouchableOpacity 
        key={concept.id}
        style={styles.conceptItem}
        onPress={() => router.push(`/concept/${concept.id}`)}
      >
        <View style={styles.conceptHeader}>
          <Text style={styles.conceptName}>{concept.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>
              {concept.status.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.conceptDescription}>{concept.description}</Text>
      </TouchableOpacity>
    );
  };

  const renderVideo = (video: Video) => (
    <TouchableOpacity 
      key={video.id}
      style={styles.videoCard}
      onPress={() => router.push(`/video/${video.id}`)}
    >
      <VideoThumbnail video={video} />
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.videoAuthor}>{video.authorName}</Text>
        <View style={styles.videoMetadata}>
          <Text style={styles.videoViews}>{video.viewCount} views</Text>
          {video.conceptIds?.map(conceptId => {
            const concept = subject?.concepts.find(c => c.id === conceptId);
            return concept ? (
              <View key={conceptId} style={styles.videoConceptTag}>
                <Text style={styles.videoConceptText}>{concept.name}</Text>
              </View>
            ) : null;
          })}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(['overview', 'summaries', 'quizzes', 'reflections'] as TabType[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search videos..."
        placeholderTextColor="#666"
        value={filterOptions.searchQuery}
        onChangeText={(text) => setFilterOptions(prev => ({ ...prev, searchQuery: text }))}
      />
    </View>
  );

  const renderFilterOptions = () => (
    <View style={styles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {/* Sort options */}
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => {
            const nextOrder = filterOptions.sortOrder === 'asc' ? 'desc' : 'asc';
            setFilterOptions(prev => ({ ...prev, sortOrder: nextOrder }));
          }}
        >
          <Ionicons 
            name={filterOptions.sortOrder === 'asc' ? "arrow-up" : "arrow-down"} 
            size={16} 
            color="#fff" 
          />
          <Text style={styles.filterButtonText}>
            {filterOptions.sortBy.charAt(0).toUpperCase() + filterOptions.sortBy.slice(1)}
          </Text>
        </TouchableOpacity>

        {/* Sort by options */}
        {['date', 'title', 'views'].map((sortOption) => (
          <TouchableOpacity 
            key={sortOption}
            style={[
              styles.filterButton,
              filterOptions.sortBy === sortOption && styles.activeFilterButton
            ]}
            onPress={() => setFilterOptions(prev => ({ ...prev, sortBy: sortOption as 'date' | 'title' | 'views' }))}
          >
            <Text style={styles.filterButtonText}>
              {sortOption.charAt(0).toUpperCase() + sortOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Concept filters */}
        {subject?.concepts.map(concept => (
          <TouchableOpacity 
            key={concept.id}
            style={[
              styles.filterButton,
              filterOptions.conceptFilter.includes(concept.id) && styles.activeFilterButton
            ]}
            onPress={() => {
              setFilterOptions(prev => ({
                ...prev,
                conceptFilter: prev.conceptFilter.includes(concept.id)
                  ? prev.conceptFilter.filter(id => id !== concept.id)
                  : [...prev.conceptFilter, concept.id]
              }));
            }}
          >
            <Text style={styles.filterButtonText}>{concept.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOverviewTab = () => (
    <View>
      <Text style={styles.description}>{subject?.description}</Text>
      
      <View style={styles.progressSection}>
        {renderProgressBar(subject?.progress || 0)}
        <Text style={styles.progressText}>{subject?.progress}% Complete</Text>
        <Text style={styles.statsText}>
          {subject?.completedVideos} / {subject?.videosCount} videos watched
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{videos.length}</Text>
          <Text style={styles.statLabel}>Total Videos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{subject?.concepts.length}</Text>
          <Text style={styles.statLabel}>Concepts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {subject?.concepts.filter(c => c.status === 'mastered').length}
          </Text>
          <Text style={styles.statLabel}>Mastered</Text>
        </View>
      </View>

      {renderSearchBar()}
      {renderFilterOptions()}

      {filteredSavedVideos.length > 0 && (
        <View style={styles.savedVideosSection}>
          <Text style={styles.sectionTitle}>Saved Videos</Text>
          <View style={styles.videoGrid}>
            {filteredSavedVideos.map(renderVideo)}
          </View>
        </View>
      )}

      <View style={styles.conceptsSection}>
        <Text style={styles.sectionTitle}>Core Concepts</Text>
        {subject?.concepts.map(renderConcept)}
      </View>

      <View style={styles.videosSection}>
        <Text style={styles.sectionTitle}>All Videos</Text>
        {filteredVideos.length > 0 ? (
          <View style={styles.videoGrid}>
            {filteredVideos.map(renderVideo)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {filterOptions.searchQuery || filterOptions.conceptFilter.length > 0
                ? 'No videos match your filters'
                : 'No videos available yet'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderSummariesTab = () => (
    <View style={styles.summariesContainer}>
      {loadingSummaries ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        Object.entries(summaries).map(([videoId, summary]) => {
          const video = videos.find(v => v.id === videoId);
          if (!video || !summary) return null;

          return (
            <View key={videoId} style={styles.summaryCard}>
              <TouchableOpacity 
                style={styles.summaryHeader}
                onPress={() => router.push(`/video/${videoId}`)}
              >
                <VideoThumbnail video={video} />
                <Text style={styles.summaryTitle}>{video.title}</Text>
              </TouchableOpacity>
              
              <View style={styles.summaryContent}>
                <Text style={styles.summarySubtitle}>Key Points</Text>
                {summary.key_points.map((point, index) => (
                  <View key={index} style={styles.bulletPoint}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.summaryText}>{point}</Text>
                  </View>
                ))}

                <Text style={[styles.summarySubtitle, { marginTop: 16 }]}>
                  Main Concepts
                </Text>
                {summary.main_concepts.map((concept, index) => (
                  <View key={index} style={styles.bulletPoint}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.summaryText}>{concept}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}
      {!loadingSummaries && Object.keys(summaries).length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No summaries available yet</Text>
        </View>
      )}
    </View>
  );

  const renderQuizzesTab = () => (
    <View style={styles.quizzesContainer}>
      <View style={styles.comingSoon}>
        <Ionicons name="school-outline" size={48} color="#666" />
        <Text style={styles.comingSoonTitle}>Quizzes Coming Soon</Text>
        <Text style={styles.comingSoonText}>
          Test your knowledge with interactive quizzes for each video and concept
        </Text>
      </View>
    </View>
  );

  const renderReflectionsTab = () => (
    <View style={styles.reflectionsContainer}>
      <View style={styles.comingSoon}>
        <Ionicons name="journal-outline" size={48} color="#666" />
        <Text style={styles.comingSoonTitle}>Reflections Coming Soon</Text>
        <Text style={styles.comingSoonText}>
          Record your thoughts and insights as you learn each concept
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  if (error || !subject) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Subject not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSubjectAndVideos}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{subject.name}</Text>
      </View>

      {renderTabs()}

      <View style={styles.content}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'summaries' && renderSummariesTab()}
        {activeTab === 'quizzes' && renderQuizzesTab()}
        {activeTab === 'reflections' && renderReflectionsTab()}
      </View>
    </ScrollView>
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 24,
    lineHeight: 24,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1a472a',
  },
  progressText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  graphSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  graphPlaceholder: {
    height: 200,
    backgroundColor: '#222',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  graphText: {
    color: '#666',
    textAlign: 'center',
  },
  conceptsSection: {
    marginBottom: 24,
  },
  conceptItem: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  conceptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conceptName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  conceptDescription: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  videosSection: {
    marginBottom: 24,
  },
  videoGrid: {
    gap: 16,
  },
  videoCard: {
    backgroundColor: '#222',
    borderRadius: 10,
    overflow: 'hidden',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  videoAuthor: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  videoMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  videoViews: {
    fontSize: 12,
    color: '#666',
  },
  videoConceptTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  videoConceptText: {
    fontSize: 12,
    color: '#fff',
  },
  emptyState: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  savedVideosSection: {
    marginBottom: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#222',
    padding: 4,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#333',
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
  },
  summariesContainer: {
    gap: 16,
  },
  summaryCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  summaryHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    padding: 12,
  },
  summaryContent: {
    padding: 16,
  },
  summarySubtitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bulletDot: {
    color: '#666',
    marginRight: 8,
    fontSize: 14,
  },
  summaryText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  quizzesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoon: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  comingSoonTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  reflectionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 0,
  },
  filterContainer: {
    marginBottom: 24,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#1a472a',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
}); 