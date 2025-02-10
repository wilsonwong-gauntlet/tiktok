import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  TextStyle,
  ViewStyle
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Subject, Concept, VideoSummary, Quiz, QuizAttempt } from '../../../types/video';
import type { Video } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { VideoService } from '../../../services/firebase/video';
import { auth } from '../../../services/firebase';
import VideoThumbnail from '../../../components/VideoThumbnail';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import QuizPanel from '../../../components/QuizPanel';
import { getLastQuizAttempt } from '../../../services/firebase/learning';
import Markdown from 'react-native-markdown-display';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

type TabType = 'overview' | 'summaries' | 'quizzes' | 'reflections' | 'reading';

type FilterOptions = {
  searchQuery: string;
  sortBy: 'date' | 'title' | 'views';
  sortOrder: 'asc' | 'desc';
  conceptFilter: string[];
};

type Note = {
  id: string;
  videoId: string;
  content: string;
  keyTakeaways: string[];
  reflections: {
    understanding: string[];
    gaps: string[];
    applications: string[];
    connections: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};

interface VideoWithQuiz {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  createdAt: Date;
  conceptIds: string[];
  viewCount: number;
  authorName: string;
  quiz?: Quiz;
}

const markdownStyles = StyleSheet.create({
  body: {
    color: '#fff',
    fontSize: 16,
  } as TextStyle,
  heading1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 10,
  } as TextStyle,
  heading2: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginVertical: 8,
  } as TextStyle,
  heading3: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 6,
  } as TextStyle,
  strong: {
    color: '#fff',
    fontWeight: '700',
  } as TextStyle,
  em: {
    color: '#fff',
    fontStyle: 'italic',
  } as TextStyle,
  link: {
    color: '#1a472a',
  } as TextStyle,
  bullet_list: {
    marginVertical: 8,
  } as ViewStyle,
  ordered_list: {
    marginVertical: 8,
  } as ViewStyle,
  code_inline: {
    color: '#fff',
    backgroundColor: '#333',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'Courier',
  } as TextStyle,
  code_block: {
    color: '#fff',
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    fontFamily: 'Courier',
    marginVertical: 8,
  } as TextStyle,
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#666',
    paddingLeft: 10,
    marginVertical: 8,
  } as ViewStyle,
});

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
  const [notes, setNotes] = useState<{[key: string]: Note}>({});
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [expandedSummaryRows, setExpandedSummaryRows] = useState<Set<string>>(new Set());
  const [expandedReflectionRows, setExpandedReflectionRows] = useState<Set<string>>(new Set());
  const [expandedQuizzes, setExpandedQuizzes] = useState<Set<string>>(new Set());
  const [quizAttempts, setQuizAttempts] = useState<Record<string, QuizAttempt | null>>({});
  const [expandedReadingRows, setExpandedReadingRows] = useState<Set<string>>(new Set());
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    loadSubjectAndVideos();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'summaries' && videos.length > 0 && Object.keys(summaries).length === 0) {
      loadAllSummaries();
    }
  }, [activeTab, videos]);

  useEffect(() => {
    const filtered = filterContent();
    setFilteredVideos(filtered);
    
    // Also filter saved videos
    const filteredSaved = savedVideos.filter(video => {
      const matchesSearch = filterOptions.searchQuery === '' ||
        video.title.toLowerCase().includes(filterOptions.searchQuery.toLowerCase()) ||
        video.description.toLowerCase().includes(filterOptions.searchQuery.toLowerCase());

      const matchesConcepts = filterOptions.conceptFilter.length === 0 ||
        video.conceptIds.some(id => filterOptions.conceptFilter.includes(id));

      return matchesSearch && matchesConcepts;
    });
    setFilteredSavedVideos(filteredSaved);
  }, [filterOptions, videos, savedVideos]);

  useEffect(() => {
    if (activeTab === 'reflections' && videos.length > 0) {
      loadNotes();
    }
  }, [activeTab, videos]);

  useEffect(() => {
    if (auth.currentUser) {
      loadQuizAttempts();
    }
  }, []);

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
    if (!auth.currentUser || !id) {
      console.log('Missing required data:', { auth: !!auth.currentUser, id });
      return;
    }

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
        console.error('Subject not found:', id);
        setError('Subject not found');
        return;
      }
      console.log('Loaded subject:', subjectData);
      setSubject(subjectData);

      // Load all related videos
      console.log('Fetching videos for subject:', id);
      const subjectVideos = await VideoService.getVideosBySubject(id as string);
      console.log('Loaded subject videos:', {
        count: subjectVideos.length,
        videos: subjectVideos.map(v => ({
          id: v.id,
          title: v.title,
          subjectId: v.subjectId
        }))
      });
      setVideos(subjectVideos);

      // Load saved videos for this subject
      const savedVideoIds = await VideoService.getSavedVideoIds(auth.currentUser.uid);
      console.log('Loaded saved video IDs:', savedVideoIds);
      
      const savedSubjectVideos = subjectVideos.filter(video => savedVideoIds.includes(video.id));
      console.log('Filtered saved subject videos:', {
        count: savedSubjectVideos.length,
        videos: savedSubjectVideos.map(v => ({
          id: v.id,
          title: v.title
        }))
      });
      setSavedVideos(savedSubjectVideos);

    } catch (error) {
      console.error('Error loading subject:', error);
      setError('Failed to load subject');
    } finally {
      setLoading(false);
    }
  };

  const filterContent = useCallback(() => {
    if (!videos) return [];

    return videos.filter(video => {
      const matchesSearch = filterOptions.searchQuery === '' ||
        video.title.toLowerCase().includes(filterOptions.searchQuery.toLowerCase()) ||
        video.description.toLowerCase().includes(filterOptions.searchQuery.toLowerCase());

      const matchesConcepts = filterOptions.conceptFilter.length === 0 ||
        video.conceptIds.some(id => filterOptions.conceptFilter.includes(id));

      return matchesSearch && matchesConcepts;
    }).sort((a, b) => {
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
  }, [videos, filterOptions]);

  const loadNotes = async () => {
    if (!auth.currentUser) return;

    try {
      setLoadingNotes(true);
      const notesRef = collection(db, 'users', auth.currentUser.uid, 'notes');
      const notesQuery = query(notesRef, where('videoId', 'in', videos.map(v => v.id)));
      const snapshot = await getDocs(notesQuery);
      
      const notesMap = snapshot.docs.reduce((acc, doc) => {
        const note = {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        } as Note;
        acc[note.videoId] = note;
        return acc;
      }, {} as {[key: string]: Note});
      
      setNotes(notesMap);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const loadQuizAttempts = async () => {
    if (!auth.currentUser) return;
    
    const videos = filterContent();
    if (!videos) return;

    const attempts: Record<string, QuizAttempt | null> = {};
    
    for (const video of videos) {
      if (video.quiz) {
        const attempt = await getLastQuizAttempt(auth.currentUser.uid, video.quiz.id);
        if (attempt) {
          attempts[video.id] = attempt;
        } else {
          attempts[video.id] = null;
        }
      }
    }
    
    setQuizAttempts(attempts);
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
    <View style={styles.tabs}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
        onPress={() => setActiveTab('overview')}
      >
        <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'summaries' && styles.activeTab]}
        onPress={() => setActiveTab('summaries')}
      >
        <Text style={[styles.tabText, activeTab === 'summaries' && styles.activeTabText]}>Summaries</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'quizzes' && styles.activeTab]}
        onPress={() => setActiveTab('quizzes')}
      >
        <Text style={[styles.tabText, activeTab === 'quizzes' && styles.activeTabText]}>Quizzes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'reading' && styles.activeTab]}
        onPress={() => setActiveTab('reading')}
      >
        <Text style={[styles.tabText, activeTab === 'reading' && styles.activeTabText]}>Reading</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'reflections' && styles.activeTab]}
        onPress={() => setActiveTab('reflections')}
      >
        <Text style={[styles.tabText, activeTab === 'reflections' && styles.activeTabText]}>Reflections</Text>
      </TouchableOpacity>
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
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{videos.length}</Text>
          <Text style={styles.statLabel}>Total Videos</Text>
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

  const renderSummariesTab = () => {
    const toggleSummaryRow = (videoId: string) => {
      const newExpanded = new Set(expandedSummaryRows);
      if (newExpanded.has(videoId)) {
        newExpanded.delete(videoId);
      } else {
        newExpanded.add(videoId);
      }
      setExpandedSummaryRows(newExpanded);
    };

    return (
      <View style={styles.summariesContainer}>
        {loadingSummaries ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableHeaderCell, { flex: 1 }]}>
                <Text style={styles.tableHeaderText}>Video Title</Text>
              </View>
              <View style={styles.tableHeaderCell}>
                <Text style={styles.tableHeaderText}>Points</Text>
              </View>
            </View>

            <ScrollView style={styles.tableContent}>
              {Object.entries(summaries).map(([videoId, summary]) => {
                const video = videos.find(v => v.id === videoId);
                if (!video || !summary) return null;

                const isExpanded = expandedSummaryRows.has(videoId);

                return (
                  <View key={videoId} style={styles.tableRowContainer}>
                    <TouchableOpacity 
                      style={styles.tableRow}
                      onPress={() => toggleSummaryRow(videoId)}
                    >
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <Text style={styles.tableCellTitle} numberOfLines={2}>
                          {video.title}
                        </Text>
                      </View>
                      <View style={[styles.tableCell, { width: 80, alignItems: 'center' }]}>
                        <Text style={styles.tableCellText}>
                          {summary.key_points.length} points
                        </Text>
                      </View>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color="#666" 
                        style={{ marginLeft: 8 }}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.expandedContent}>
                        <View style={styles.expandedSection}>
                          <Text style={styles.expandedTitle}>Key Points</Text>
                          {summary.key_points.map((point, index) => (
                            <View key={index} style={styles.bulletPoint}>
                              <Markdown style={markdownStyles}>
                                {point}
                              </Markdown>
                            </View>
                          ))}
                        </View>

                        <View style={styles.expandedSection}>
                          <Text style={styles.expandedTitle}>Main Concepts</Text>
                          <View style={styles.expandedConceptTags}>
                            {summary.main_concepts.map((concept, index) => (
                              <View key={index} style={styles.conceptTag}>
                                <Text style={styles.conceptTagText}>{concept}</Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        <TouchableOpacity 
                          style={styles.watchButton}
                          onPress={() => router.push(`/video/${videoId}`)}
                        >
                          <Ionicons name="play-circle-outline" size={20} color="#fff" />
                          <Text style={styles.watchButtonText}>Watch Video</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
        {!loadingSummaries && Object.keys(summaries).length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No summaries available yet</Text>
          </View>
        )}
      </View>
    );
  };

  const renderReflectionsTab = () => {
    const toggleReflectionRow = (videoId: string) => {
      const newExpanded = new Set(expandedReflectionRows);
      if (newExpanded.has(videoId)) {
        newExpanded.delete(videoId);
      } else {
        newExpanded.add(videoId);
      }
      setExpandedReflectionRows(newExpanded);
    };

    return (
      <View style={styles.reflectionsContainer}>
        {loadingNotes ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : Object.entries(notes).length > 0 ? (
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableHeaderCell, { flex: 2 }]}>
                <Text style={styles.tableHeaderText}>Video Title</Text>
              </View>
              <View style={[styles.tableHeaderCell, { flex: 1 }]}>
                <Text style={styles.tableHeaderText}>Understanding</Text>
              </View>
              <View style={[styles.tableHeaderCell, { flex: 1 }]}>
                <Text style={styles.tableHeaderText}>Last Updated</Text>
              </View>
            </View>

            <ScrollView style={styles.tableContent}>
              {Object.entries(notes).map(([videoId, note]) => {
                const video = videos.find(v => v.id === videoId);
                if (!video) return null;

                const reflectionTypes = ['gaps', 'applications', 'connections'] as const;
                const isExpanded = expandedReflectionRows.has(videoId);

                return (
                  <View key={videoId} style={styles.tableRowContainer}>
                    <TouchableOpacity 
                      style={styles.tableRow}
                      onPress={() => toggleReflectionRow(videoId)}
                    >
                      <View style={[styles.tableCell, { flex: 2 }]}>
                        <Text style={styles.tableCellTitle} numberOfLines={2}>
                          {video.title}
                        </Text>
                      </View>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <View style={styles.reflectionStats}>
                          <Text style={styles.tableCellText}>
                            {note.reflections.understanding.length} points
                          </Text>
                          <View style={styles.reflectionIndicators}>
                            {reflectionTypes.map(type => (
                              <View 
                                key={type}
                                style={[
                                  styles.indicator,
                                  note.reflections[type].length > 0 && styles.indicatorActive
                                ]}
                              />
                            ))}
                          </View>
                        </View>
                      </View>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <Text style={styles.tableCellText}>
                          {note.updatedAt.toLocaleDateString()}
                        </Text>
                      </View>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color="#666" 
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.expandedContent}>
                        {note.content && (
                          <View style={styles.expandedSection}>
                            <Text style={styles.expandedTitle}>Quick Capture</Text>
                            <Text style={styles.expandedText}>{note.content}</Text>
                          </View>
                        )}

                        {note.keyTakeaways?.length > 0 && (
                          <View style={styles.expandedSection}>
                            <Text style={styles.expandedTitle}>Key Takeaways</Text>
                            {note.keyTakeaways.map((point, index) => (
                              <View key={index} style={styles.bulletPoint}>
                                <Text style={styles.bulletDot}>•</Text>
                                <Text style={styles.bulletText}>{point}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        <View style={styles.expandedSection}>
                          <Text style={styles.expandedTitle}>Understanding</Text>
                          {note.reflections.understanding.map((item, index) => (
                            <View key={index} style={styles.bulletPoint}>
                              <Text style={styles.bulletDot}>•</Text>
                              <Text style={styles.bulletText}>{item}</Text>
                            </View>
                          ))}
                        </View>

                        {reflectionTypes.map(type => (
                          note.reflections[type].length > 0 && (
                            <View key={type} style={styles.expandedSection}>
                              <Text style={styles.expandedTitle}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </Text>
                              {note.reflections[type].map((item, index) => (
                                <View key={index} style={styles.bulletPoint}>
                                  <Text style={styles.bulletDot}>•</Text>
                                  <Text style={styles.bulletText}>{item}</Text>
                                </View>
                              ))}
                            </View>
                          )
                        ))}

                        <TouchableOpacity 
                          style={styles.watchButton}
                          onPress={() => router.push(`/video/${videoId}`)}
                        >
                          <Ionicons name="play-circle-outline" size={20} color="#fff" />
                          <Text style={styles.watchButtonText}>Watch Video</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="journal-outline" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No Reflections Yet</Text>
            <Text style={styles.emptyText}>
              Start watching videos and add your reflections to track your learning journey
            </Text>
          </View>
        )}
      </View>
    );
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const toggleQuizRow = useCallback((videoId: string) => {
    setExpandedQuizzes(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }, []);

  const renderQuizzesTab = () => {
    const filteredVideos = filterContent().filter(video => video.quiz);

    if (filteredVideos.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No quizzes available for this subject</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {renderSearchBar()}
        {renderFilterOptions()}
        
        <ScrollView style={styles.scrollContent}>
          {filteredVideos.map((video) => {
            const attempt = quizAttempts[video.id];
            const score = attempt?.score ?? 0;
            const quiz = video.quiz;
            
            if (!quiz) return null;
            
            return (
              <View key={video.id} style={styles.contentRow}>
                <TouchableOpacity
                  style={styles.rowHeader}
                  onPress={() => toggleQuizRow(video.id)}
                >
                  <View style={styles.rowHeaderContent}>
                    <Text style={styles.rowTitle}>{video.title}</Text>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowMetaText}>
                        {quiz.questions.length} questions
                      </Text>
                      {auth.currentUser && quizAttempts[video.id] !== undefined && (
                        <Text style={[
                          styles.rowMetaText,
                          score >= 80 && styles.highScore,
                          score >= 60 && score < 80 && styles.mediumScore,
                          score < 60 && styles.lowScore,
                        ]}>
                          {attempt 
                            ? ` • Last attempt: ${formatDate(attempt.completedAt)} (${Math.round(score)}%)`
                            : ' • Not attempted'}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name={expandedQuizzes.has(video.id) ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>

                {expandedQuizzes.has(video.id) && (
                  <View style={styles.expandedContent}>
                    <QuizPanel
                      quiz={quiz}
                      videoId={video.id}
                      subjectId={id as string}
                      onComplete={async (score) => {
                        if (auth.currentUser) {
                          setQuizAttempts(prev => ({
                            ...prev,
                            [video.id]: {
                              id: `${quiz.id}_${Date.now()}`,
                              userId: auth.currentUser!.uid,
                              quizId: quiz.id,
                              score,
                              completedAt: new Date(),
                              answers: []
                            }
                          }));
                        }
                      }}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderReadingTab = () => {
    const toggleReadingRow = (videoId: string) => {
      const newExpandedRows = new Set(expandedReadingRows);
      if (expandedReadingRows.has(videoId)) {
        newExpandedRows.delete(videoId);
      } else {
        newExpandedRows.add(videoId);
      }
      setExpandedReadingRows(newExpandedRows);
    };

    return (
      <ScrollView style={styles.tabContent}>
        {videos.map((video) => (
          <View key={video.id} style={styles.row}>
            <TouchableOpacity
              style={styles.rowHeader}
              onPress={() => toggleReadingRow(video.id)}
            >
              <View style={styles.rowTitleContainer}>
                <Text style={styles.rowTitle}>{video.title}</Text>
                <Text style={styles.rowSubtitle}>
                  {video.furtherReading?.length || 0} recommended resources
                </Text>
              </View>
              <Ionicons
                name={expandedReadingRows.has(video.id) ? "chevron-up" : "chevron-down"}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            {expandedReadingRows.has(video.id) && video.furtherReading && (
              <View style={styles.readingList}>
                {video.furtherReading.map((reading, index) => (
                  <View key={index} style={styles.readingCard}>
                    <Text style={styles.readingTitle}>{reading.title}</Text>
                    <Text style={styles.readingAuthor}>By {reading.author}</Text>
                    <Text style={styles.readingDescription}>{reading.description}</Text>
                  </View>
                ))}
                {!video.furtherReading?.length && (
                  <Text style={styles.emptyText}>No further reading available</Text>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'videos':
        return (
          <View style={styles.sectionContent}>
            <View style={styles.sectionContentHeader}>
              <TouchableOpacity 
                style={styles.backToOverview}
                onPress={() => setSelectedSection(null)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.backToOverviewText}>Back to Overview</Text>
              </TouchableOpacity>
            </View>
            {renderSearchBar()}
            {renderFilterOptions()}
            <View style={styles.videoList}>
              {filteredSavedVideos.length > 0 && (
                <View style={styles.savedVideosSection}>
                  <Text style={styles.videoSectionTitle}>Saved Videos</Text>
                  {filteredSavedVideos.map(video => (
                    <TouchableOpacity 
                      key={video.id}
                      style={[styles.videoItem, styles.savedVideoItem]}
                      onPress={() => router.push(`/video/${video.id}`)}
                    >
                      <Text style={styles.videoTitle}>{video.title}</Text>
                      <Text style={styles.videoDuration}>
                        {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              <Text style={styles.videoSectionTitle}>All Videos</Text>
              {filteredVideos.map(video => (
                <TouchableOpacity 
                  key={video.id}
                  style={styles.videoItem}
                  onPress={() => router.push(`/video/${video.id}`)}
                >
                  <Text style={styles.videoTitle}>{video.title}</Text>
                  <Text style={styles.videoDuration}>
                    {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 'reading':
        return (
          <View style={styles.sectionContent}>
            <View style={styles.sectionContentHeader}>
              <TouchableOpacity 
                style={styles.backToOverview}
                onPress={() => setSelectedSection(null)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.backToOverviewText}>Back to Overview</Text>
              </TouchableOpacity>
            </View>
            {renderReadingTab()}
          </View>
        );
      case 'summaries':
        return (
          <View style={styles.sectionContent}>
            <View style={styles.sectionContentHeader}>
              <TouchableOpacity 
                style={styles.backToOverview}
                onPress={() => setSelectedSection(null)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.backToOverviewText}>Back to Overview</Text>
              </TouchableOpacity>
            </View>
            {renderSummariesTab()}
          </View>
        );
      case 'quizzes':
        return (
          <View style={styles.sectionContent}>
            <View style={styles.sectionContentHeader}>
              <TouchableOpacity 
                style={styles.backToOverview}
                onPress={() => setSelectedSection(null)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.backToOverviewText}>Back to Overview</Text>
              </TouchableOpacity>
            </View>
            {renderQuizzesTab()}
          </View>
        );
      case 'reflections':
        return (
          <View style={styles.sectionContent}>
            <View style={styles.sectionContentHeader}>
              <TouchableOpacity 
                style={styles.backToOverview}
                onPress={() => setSelectedSection(null)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.backToOverviewText}>Back to Overview</Text>
              </TouchableOpacity>
            </View>
            {renderReflectionsTab()}
          </View>
        );
      default:
        return (
          <>
            {/* Learning Materials Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Learning Materials</Text>
              <View style={styles.learningGrid}>
                <TouchableOpacity 
                  style={styles.learningCard}
                  onPress={() => setSelectedSection('videos')}
                >
                  <View style={styles.cardIconContainer}>
                    <Ionicons name="play-circle" size={24} color="#fff" />
                  </View>
                  <Text style={styles.cardTitle}>Video Lessons</Text>
                  <Text style={styles.cardSubtext}>{videos.length} videos</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.learningCard}
                  onPress={() => setSelectedSection('reading')}
                >
                  <View style={styles.cardIconContainer}>
                    <Ionicons name="book" size={24} color="#fff" />
                  </View>
                  <Text style={styles.cardTitle}>Reading Materials</Text>
                  <Text style={styles.cardSubtext}>Additional resources</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Study Tools Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Study Tools</Text>
              <View style={styles.learningGrid}>
                <TouchableOpacity 
                  style={styles.learningCard}
                  onPress={() => setSelectedSection('summaries')}
                >
                  <View style={styles.cardIconContainer}>
                    <Ionicons name="document-text" size={24} color="#fff" />
                  </View>
                  <Text style={styles.cardTitle}>Video Summaries</Text>
                  <Text style={styles.cardSubtext}>Quick review materials</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.learningCard}
                  onPress={() => setSelectedSection('quizzes')}
                >
                  <View style={styles.cardIconContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  </View>
                  <Text style={styles.cardTitle}>Practice Quizzes</Text>
                  <Text style={styles.cardSubtext}>Test your knowledge</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Personal Progress Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Your Learning Journey</Text>
              <TouchableOpacity 
                style={styles.reflectionCard}
                onPress={() => setSelectedSection('reflections')}
              >
                <View style={styles.reflectionHeader}>
                  <Ionicons name="journal" size={24} color="#fff" />
                  <Text style={styles.reflectionTitle}>Learning Reflections</Text>
                </View>
                <Text style={styles.reflectionSubtext}>
                  Track your understanding and insights
                </Text>
              </TouchableOpacity>
            </View>
          </>
        );
    }
  };

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

      <View style={styles.content}>
        {/* Introduction Section */}
        <View style={styles.section}>
          <Text style={styles.description}>{subject?.description}</Text>
        </View>

        {renderSectionContent()}
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
    paddingBottom: 40,
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
  tableContainer: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  tableHeaderCell: {
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tableContent: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    padding: 12,
  },
  tableCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tableCellTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tableCellText: {
    color: '#999',
    fontSize: 14,
  },
  conceptTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  conceptTag: {
    backgroundColor: '#1a472a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conceptTagText: {
    color: '#fff',
    fontSize: 12,
  },
  moreText: {
    color: '#666',
    fontSize: 12,
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
    gap: 16,
  },
  reflectionStats: {
    alignItems: 'center',
  },
  reflectionIndicators: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  indicatorActive: {
    backgroundColor: '#1a472a',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
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
  tableRowContainer: {
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  expandedContent: {
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  expandedSection: {
    marginBottom: 16,
  },
  expandedTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  expandedText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  expandedConceptTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  bulletText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a472a',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  watchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  contentRow: {
    backgroundColor: '#222',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  rowHeaderContent: {
    flex: 1,
    marginRight: 16,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMetaText: {
    fontSize: 14,
    color: '#666',
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  highScore: {
    color: '#4CAF50',
  },
  mediumScore: {
    color: '#FFC107',
  },
  lowScore: {
    color: '#f44336',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#222',
    padding: 4,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 8,
  },
  row: {
    backgroundColor: '#222',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  rowTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  rowSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  readingList: {
    padding: 16,
  },
  readingCard: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  readingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  readingAuthor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  readingDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  statsCard: {
    backgroundColor: '#1a472a',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statsSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  learningGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  learningCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  cardIconContainer: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 14,
    color: '#666',
  },
  reflectionCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  reflectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  reflectionSubtext: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
  },
  sectionContent: {
    flex: 1,
  },
  sectionContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backToOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backToOverviewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  videoList: {
    paddingTop: 16,
  },
  videoItem: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  videoDuration: {
    color: '#666',
    fontSize: 14,
  },
  videoSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 16,
  },
  savedVideosSection: {
    marginBottom: 24,
  },
  savedVideoItem: {
    borderColor: '#1a472a',
    borderWidth: 1,
  },
}); 