import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../services/firebase/index';
import { collection, query, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';

interface Note {
  id: string;
  videoId: string;
  videoTitle: string;
  subjectName: string;
  content: string;
  timestamp: number;
  createdAt: Date;
}

interface NotesListProps {
  cachedNotes: {
    id: string;
    videoId: string;
    videoTitle: string;
    subjectName: string;
    content: string;
    timestamp: number;
    createdAt: Date;
  }[];
  loading: boolean;
}

export default function NotesList({ cachedNotes, loading }: NotesListProps) {
  const router = useRouter();

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        {[1, 2, 3].map((_, index) => (
          <View key={index} style={[styles.noteCard, styles.skeletonCard]}>
            <View style={[styles.skeletonText, { width: '70%', marginBottom: 12 }]} />
            <View style={[styles.skeletonText, { width: '90%', height: 60, marginBottom: 16 }]} />
            <View style={styles.noteMeta}>
              <View style={[styles.skeletonText, { width: 80 }]} />
              <View style={[styles.skeletonText, { width: 60 }]} />
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  const renderNoteRow = ({ item: note }: { item: NotesListProps['cachedNotes'][0] }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/note/${note.videoId}/${note.id}`)}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            <Ionicons name="document-text-outline" size={16} color="#666" />
            <Text style={styles.noteText} numberOfLines={2}>
              {note.content}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {note.subjectName} • From {note.videoTitle} • {formatVideoTimestamp(note.timestamp)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const formatVideoTimestamp = (seconds: number): string => {
    try {
      const date = new Date(0);
      date.setSeconds(seconds);
      return date.toISOString().substr(11, 8);
    } catch (error) {
      console.error('Error formatting video timestamp:', error);
      return '00:00:00';
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={cachedNotes}
        renderItem={renderNoteRow}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notes taken</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowContent: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
  },
  metaText: {
    color: '#666',
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#222',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  noteCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 4,
    marginBottom: 16,
  },
  skeletonCard: {
    opacity: 0.7,
  },
  skeletonText: {
    backgroundColor: '#333',
    borderRadius: 4,
    height: 16,
  },
  noteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}); 