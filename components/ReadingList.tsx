import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FurtherReading } from '../types/video';

interface ReadingListProps {
  readings: {
    [subjectId: string]: {
      subjectName: string;
      resources: {
        videoId: string;
        videoTitle: string;
        resource: FurtherReading;
      }[];
    };
  };
  onResourcePress: (videoId: string, resource: FurtherReading) => void;
}

export default function ReadingList({ readings, onResourcePress }: ReadingListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  const toggleSubject = (subjectId: string) => {
    const newExpanded = new Set(expandedSubjects);
    if (newExpanded.has(subjectId)) {
      newExpanded.delete(subjectId);
    } else {
      newExpanded.add(subjectId);
    }
    setExpandedSubjects(newExpanded);
  };

  const filterResources = (resources: ReadingListProps['readings']) => {
    if (!searchQuery) return resources;

    const filteredReadings: ReadingListProps['readings'] = {};
    
    Object.entries(resources).forEach(([subjectId, subject]) => {
      const filteredResources = subject.resources.filter(
        resource => 
          resource.resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          resource.resource.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          resource.resource.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          resource.videoTitle.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (filteredResources.length > 0) {
        filteredReadings[subjectId] = {
          ...subject,
          resources: filteredResources,
        };
      }
    });

    return filteredReadings;
  };

  const filteredReadings = filterResources(readings);
  const totalResources = Object.values(readings).reduce(
    (sum, subject) => sum + subject.resources.length,
    0
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reading List ({totalResources})</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search resources..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {Object.entries(filteredReadings).map(([subjectId, subject]) => (
          <View key={subjectId} style={styles.subjectSection}>
            <TouchableOpacity
              style={styles.subjectHeader}
              onPress={() => toggleSubject(subjectId)}
            >
              <View style={styles.subjectTitleContainer}>
                <Text style={styles.subjectTitle}>{subject.subjectName}</Text>
                <Text style={styles.resourceCount}>
                  {subject.resources.length} resources
                </Text>
              </View>
              <Ionicons
                name={expandedSubjects.has(subjectId) ? "chevron-up" : "chevron-down"}
                size={24}
                color="#666"
              />
            </TouchableOpacity>

            {expandedSubjects.has(subjectId) && (
              <View style={styles.resourcesList}>
                {subject.resources.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.videoId}-${index}`}
                    style={styles.resourceCard}
                    onPress={() => onResourcePress(item.videoId, item.resource)}
                  >
                    <Text style={styles.resourceTitle}>{item.resource.title}</Text>
                    <Text style={styles.resourceAuthor}>by {item.resource.author}</Text>
                    <Text style={styles.resourceDescription} numberOfLines={2}>
                      {item.resource.description}
                    </Text>
                    <Text style={styles.videoReference}>
                      From: {item.videoTitle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}

        {Object.keys(filteredReadings).length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color="#666" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching resources found' : 'No reading resources yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Watch videos to get recommended reading materials'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 10,
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
  content: {
    flex: 1,
  },
  subjectSection: {
    marginBottom: 16,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 10,
    marginHorizontal: 20,
  },
  subjectTitleContainer: {
    flex: 1,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  resourceCount: {
    fontSize: 14,
    color: '#666',
  },
  resourcesList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  resourceCard: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  resourceAuthor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  resourceDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    marginBottom: 8,
  },
  videoReference: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 