import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SUBJECT_DATA, Subject } from '../../../types/subject';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const GRID_PADDING = 16;
const GRID_SPACING = 12;
const CARD_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_SPACING * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const subjects = Object.values(SUBJECT_DATA);
  const filteredSubjects = subjects.filter(subject => 
    subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subject.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subject.topics.some(topic => topic.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderSubjectCard = ({ item }: { item: Subject }) => (
    <TouchableOpacity 
      style={[styles.subjectCard, { backgroundColor: item.color }]}
      onPress={() => router.push(`/(app)/subject/${item.id}`)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.subjectName}>{item.name}</Text>
        <Text style={styles.courseCount}>{item.courseCount} courses</Text>
        <View style={styles.topicsContainer}>
          {item.topics.slice(0, 3).map((topic, index) => (
            <Text key={index} style={styles.topicText} numberOfLines={1}>
              • {topic}
            </Text>
          ))}
        </View>
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
            placeholder="Search subjects..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredSubjects}
        renderItem={renderSubjectCard}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No subjects found</Text>
          </View>
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
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
  clearButton: {
    padding: 4,
  },
  grid: {
    padding: GRID_PADDING,
    gap: GRID_SPACING,
  },
  subjectCard: {
    width: CARD_WIDTH,
    aspectRatio: 0.8,
    borderRadius: 16,
    marginBottom: GRID_SPACING,
    marginRight: GRID_SPACING,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  subjectName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  courseCount: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  topicsContainer: {
    marginTop: 'auto',
  },
  topicText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
}); 