import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video } from '../../../types/video';
import { router } from 'expo-router';
import { VideoService } from '../../../services/firebase/video';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { debounce } from 'lodash';
import VideoCard from '../../../components/VideoCard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 10;

// Add these types at the top of the file
interface SearchFilters {
  category?: string;
  tags: string[];
}

interface SearchState {
  query: string;
  filters: SearchFilters;
  pagination: {
    lastVisible: QueryDocumentSnapshot<any> | null;
    hasMore: boolean;
  };
}

interface SearchResults {
  videos: Video[];
  loading: boolean;
  error?: string;
}

// Add new component for active filters
const ActiveFilters = ({ 
  filters, 
  onRemoveCategory, 
  onRemoveTag, 
  onClearAll 
}: { 
  filters: SearchFilters;
  onRemoveCategory: () => void;
  onRemoveTag: (tag: string) => void;
  onClearAll: () => void;
}) => {
  const hasFilters = filters.category || filters.tags.length > 0;
  
  if (!hasFilters) return null;

  return (
    <View style={styles.activeFiltersContainer}>
      <View style={styles.activeFiltersList}>
        {filters.category && (
          <View style={styles.activeFilterChip}>
            <Text style={styles.activeFilterText}>{filters.category}</Text>
            <TouchableOpacity onPress={onRemoveCategory}>
              <Ionicons name="close-circle" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        {filters.tags.map(tag => (
          <View key={tag} style={styles.activeFilterChip}>
            <Text style={styles.activeFilterText}>#{tag}</Text>
            <TouchableOpacity onPress={() => onRemoveTag(tag)}>
              <Ionicons name="close-circle" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {hasFilters && (
        <TouchableOpacity onPress={onClearAll} style={styles.clearAllButton}>
          <Text style={styles.clearAllText}>Clear all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function Search() {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    filters: {
      category: undefined,
      tags: [],
    },
    pagination: {
      lastVisible: null,
      hasMore: true,
    }
  });

  const [searchResults, setSearchResults] = useState<SearchResults>({
    videos: [],
    loading: false,
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);

  // Load initial data
  React.useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadRecentSearches(),
        loadTrendingSearches(),
        loadFilters(),
      ]);
      // Load initial videos
      performSearch();
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  // Search effect
  // Remove: React.useEffect(() => { ... }, [searchState.query, searchState.filters.category, searchState.filters.tags]);

  const updateSearchState = (updates: Partial<SearchState>) => {
    setSearchState(prev => ({
      ...prev,
      ...updates,
      // Always reset pagination when search params change
      pagination: {
        lastVisible: null,
        hasMore: true,
      }
    }));
  };

  const performSearch = async (
    loadMore = false,
    searchQuery = searchState.query,
    searchFilters = searchState.filters
  ) => {
    try {
      const { pagination } = searchState;
      
      if (loadMore && (!pagination.hasMore || searchResults.loading)) return;
      
      setSearchResults(prev => ({ ...prev, loading: true, error: undefined }));
      
      const result = await VideoService.searchVideos(
        searchQuery,
        searchFilters,
        { field: 'createdAt', direction: 'desc' },
        loadMore && pagination.lastVisible ? pagination.lastVisible : undefined
      );

      setSearchResults(prev => ({
        loading: false,
        error: undefined,
        videos: loadMore
          ? deduplicateVideos(prev.videos, result.videos)
          : result.videos,
      }));
      
      setSearchState(prev => ({
        ...prev,
        pagination: {
          lastVisible: result.lastVisible,
          hasMore: result.videos.length > 0,
        }
      }));
    } catch (error) {
      console.error('Error searching videos:', error);
      setSearchResults(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to search videos'
      }));
    }
  };

  const debouncedSearch = React.useCallback(
    debounce((query: string, filters: SearchFilters) => {
      performSearch(false, query, filters);
    }, 300),
    []
  );

  const deduplicateVideos = (existingVideos: Video[], newVideos: Video[]): Video[] => {
    const existingIds = new Set(existingVideos.map(v => v.id));
    const uniqueNewVideos = newVideos.filter(v => !existingIds.has(v.id));
    return [...existingVideos, ...uniqueNewVideos];
  };

  // Filter handlers
  const handleSearchInput = (text: string) => {
    updateSearchState({ query: text });
    if (text.trim()) {
      debouncedSearch(text, searchState.filters);
    } else {
      // Load all videos when search is empty
      performSearch(false, '', searchState.filters);
    }
  };

  const handleSearchSubmit = () => {
    const query = searchState.query.trim();
    if (query) {
      performSearch(false, query, searchState.filters);
      // Only save to recent searches on submit
      saveRecentSearch(query);
    }
  };

  const handleCategoryPress = (category: string) => {
    const newFilters = {
      ...searchState.filters,
      category: searchState.filters.category === category ? undefined : category,
    };
    updateSearchState({ filters: newFilters });
    debouncedSearch(searchState.query, newFilters);
  };

  const handleTagPress = (tag: string) => {
    const newFilters = {
      ...searchState.filters,
      tags: searchState.filters.tags.includes(tag)
        ? searchState.filters.tags.filter(t => t !== tag)
        : [...searchState.filters.tags, tag],
    };
    updateSearchState({ filters: newFilters });
    debouncedSearch(searchState.query, newFilters);
  };

  const clearSearch = () => {
    updateSearchState({ query: '' });
    // Load all videos when clearing search
    performSearch(false, '', searchState.filters);
  };

  const clearFilters = () => {
    updateSearchState({
      filters: {
        category: undefined,
        tags: [],
      }
    });
  };

  const loadRecentSearches = async () => {
    try {
      const searches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (searches) {
        setRecentSearches(JSON.parse(searches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const searches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      let recentSearches = searches ? JSON.parse(searches) : [];
      
      // Remove the query if it already exists
      recentSearches = recentSearches.filter((s: string) => s !== query);
      
      // Add the new query to the beginning
      recentSearches.unshift(query);
      
      // Keep only the most recent searches
      recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
      
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
      setRecentSearches(recentSearches);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const loadTrendingSearches = async () => {
    // In a real app, this would fetch from your backend
    // For now, we'll use some mock trending searches
    setTrendingSearches([
      'machine learning',
      'quantum computing',
      'artificial intelligence',
      'data science',
      'programming'
    ]);
  };

  const loadFilters = async () => {
    try {
      const [categoriesResult, tagsResult] = await Promise.all([
        VideoService.getCategories(),
        VideoService.getTags()
      ]);
      setCategories(categoriesResult);
      setTags(tagsResult);
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  const clearRecentSearches = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  const renderVideo = ({ item }: { item: Video }) => (
    <TouchableOpacity 
      style={styles.videoCard}
      onPress={() => router.push({
        pathname: "/(app)/(tabs)",
        params: { videoId: item.id }
      })}
    >
      <Image 
        source={{ uri: item.thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.authorName} numberOfLines={1}>{item.authorName}</Text>
        <Text style={styles.videoDescription} numberOfLines={2}>{item.description}</Text>
        {item.aiSummary && (
          <Text style={styles.videoSummary} numberOfLines={2}>{item.aiSummary}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSuggestions = () => {
    if (!searchResults.videos.length) {
      return (
        <View style={styles.suggestionsContainer}>
          {recentSearches.length > 0 && (
            <View style={styles.suggestionSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.suggestionTitle}>Recent Searches</Text>
                <TouchableOpacity onPress={clearRecentSearches}>
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((search, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => handleSearchInput(search)}
                >
                  <View style={styles.suggestionContent}>
                    <Ionicons name="time-outline" size={20} color="#666" />
                    <Text style={styles.suggestionText}>{search}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={async () => {
                      const newSearches = recentSearches.filter((_, i) => i !== index);
                      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(newSearches));
                      setRecentSearches(newSearches);
                    }}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          <View style={styles.suggestionSection}>
            <Text style={styles.suggestionTitle}>Trending</Text>
            {trendingSearches.map((search, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => handleSearchInput(search)}
              >
                <View style={styles.suggestionContent}>
                  <Ionicons name="trending-up" size={20} color="#666" />
                  <Text style={styles.suggestionText}>{search}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search educational videos..."
            placeholderTextColor="#666"
            value={searchState.query}
            onChangeText={handleSearchInput}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchResults.loading && <ActivityIndicator size="small" color="#666" style={styles.searchLoading} />}
          {searchState.query.length > 0 && (
            <TouchableOpacity
              onPress={clearSearch}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ActiveFilters
        filters={searchState.filters}
        onRemoveCategory={() => updateSearchState({
          filters: { ...searchState.filters, category: undefined }
        })}
        onRemoveTag={(tag) => handleTagPress(tag)}
        onClearAll={clearFilters}
      />

      {searchResults.videos.length === 0 ? renderSuggestions() : (
        <View style={styles.filtersContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  searchState.filters.category === item && styles.filterChipSelected
                ]}
                onPress={() => handleCategoryPress(item)}
              >
                <Text style={[
                  styles.filterChipText,
                  searchState.filters.category === item && styles.filterChipTextSelected
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            style={styles.filtersList}
          />

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={tags}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  searchState.filters.tags.includes(item) && styles.filterChipSelected
                ]}
                onPress={() => handleTagPress(item)}
              >
                <Text style={[
                  styles.filterChipText,
                  searchState.filters.tags.includes(item) && styles.filterChipTextSelected
                ]}>
                  #{item}
                </Text>
              </TouchableOpacity>
            )}
            style={styles.filtersList}
          />
        </View>
      )}

      <FlatList
        data={searchResults.videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.resultsList}
        onEndReached={() => performSearch(true)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchResults.loading ? 'Searching...' : 'No videos found'}
            </Text>
          </View>
        )}
        ListFooterComponent={() => (
          searchResults.loading && searchResults.videos.length > 0 ? (
            <View style={styles.footer}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    zIndex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#111',
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  filtersContainer: {
    backgroundColor: '#000',
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    zIndex: 1,
  },
  filtersList: {
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  filterChip: {
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipSelected: {
    backgroundColor: '#fff',
  },
  filterChipText: {
    color: '#fff',
    fontSize: 14,
  },
  filterChipTextSelected: {
    color: '#000',
  },
  resultsList: {
    padding: 10,
  },
  videoCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#222',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  authorName: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  videoDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  videoSummary: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#333',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  suggestionsContainer: {
    backgroundColor: '#111',
    padding: 15,
  },
  suggestionSection: {
    marginBottom: 20,
  },
  suggestionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  suggestionText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  searchLoading: {
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearText: {
    color: '#666',
    fontSize: 14,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  removeButton: {
    padding: 8,
  },
  activeFiltersContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  activeFiltersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    color: '#fff',
    fontSize: 14,
  },
  clearAllButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearAllText: {
    color: '#666',
    fontSize: 14,
  },
}); 