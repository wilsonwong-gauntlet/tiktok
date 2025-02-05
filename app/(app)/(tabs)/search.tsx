import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video } from '../../../types/video';
import { router } from 'expo-router';
import { VideoService } from '../../../services/firebase/video';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { debounce } from 'lodash';
import VideoCard from '../../../components/VideoCard';

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<any> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Load categories and tags on mount
  React.useEffect(() => {
    loadFilters();
  }, []);

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

  const searchVideos = useCallback(async (loadMore = false) => {
    try {
      if (loadMore && !hasMore) return;
      
      setLoading(true);
      const result = await VideoService.searchVideos(
        searchQuery,
        {
          category: selectedCategory,
          tags: selectedTags
        },
        { field: 'createdAt', direction: 'desc' },
        loadMore && lastVisible ? lastVisible : undefined
      );

      setResults(prev => loadMore ? [...prev, ...result.videos] : result.videos);
      setLastVisible(result.lastVisible);
      setHasMore(result.videos.length > 0);
    } catch (error) {
      console.error('Error searching videos:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedTags, lastVisible, hasMore]);

  // Debounced search function
  const debouncedSearch = React.useCallback(
    debounce(() => searchVideos(), 300),
    [searchVideos]
  );

  // Update search when query or filters change
  React.useEffect(() => {
    setResults([]);
    setLastVisible(null);
    setHasMore(true);
    debouncedSearch();
  }, [searchQuery, selectedCategory, selectedTags]);

  const handleCategoryPress = (category: string) => {
    setSelectedCategory(prev => prev === category ? undefined : category);
  };

  const handleTagPress = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const renderVideo = ({ item }: { item: Video }) => (
    <TouchableOpacity 
      style={styles.videoCard}
      onPress={() => router.push({
        pathname: "/(app)/(tabs)",
        params: { videoId: item.id }
      })}
    >
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.videoDescription} numberOfLines={2}>{item.description}</Text>
        {item.aiSummary && (
          <Text style={styles.videoSummary} numberOfLines={2}>{item.aiSummary}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search educational videos..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

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
                selectedCategory === item && styles.filterChipSelected
              ]}
              onPress={() => handleCategoryPress(item)}
            >
              <Text style={[
                styles.filterChipText,
                selectedCategory === item && styles.filterChipTextSelected
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
                selectedTags.includes(item) && styles.filterChipSelected
              ]}
              onPress={() => handleTagPress(item)}
            >
              <Text style={[
                styles.filterChipText,
                selectedTags.includes(item) && styles.filterChipTextSelected
              ]}>
                #{item}
              </Text>
            </TouchableOpacity>
          )}
          style={styles.filtersList}
        />
      </View>

      <FlatList
        data={results}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.resultsList}
        onEndReached={() => searchVideos(true)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Searching...' : 'No videos found'}
            </Text>
          </View>
        )}
        ListFooterComponent={() => (
          loading && results.length > 0 ? (
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    zIndex: 1,
  },
  filtersList: {
    paddingHorizontal: 10,
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
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
}); 