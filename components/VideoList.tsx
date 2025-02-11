import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from '../types/video';
import { router } from 'expo-router';
import VideoThumbnail from './VideoThumbnail';

interface VideoListProps {
  videos?: Video[];
}

export default function VideoList({ videos = [] }: VideoListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredVideos = (videos || [])
    .filter(video => 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'desc'
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime();
      } else {
        return sortOrder === 'desc'
          ? b.title.localeCompare(a.title)
          : a.title.localeCompare(b.title);
      }
    });

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search videos..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
        >
          <Ionicons 
            name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
            size={16} 
            color="#fff" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterButton, sortBy === 'date' && styles.activeFilter]}
          onPress={() => setSortBy('date')}
        >
          <Text style={styles.filterText}>Date</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterButton, sortBy === 'title' && styles.activeFilter]}
          onPress={() => setSortBy('title')}
        >
          <Text style={styles.filterText}>Title</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {filteredVideos.map(video => (
          <TouchableOpacity
            key={video.id}
            style={styles.videoCard}
            onPress={() => router.push(`/video/${video.id}`)}
          >
            <VideoThumbnail video={video} />
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle}>{video.title}</Text>
              {video.completed && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#6B21A8" />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#fff',
    fontSize: 16,
  },
  filterBar: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilter: {
    backgroundColor: '#6B21A8',
  },
  filterText: {
    color: '#fff',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  videoCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
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
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  completedText: {
    color: '#6B21A8',
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
}); 