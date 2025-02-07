import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
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

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadNotes();
  }, []);

  const formatTimestamp = (timestamp: number | Timestamp | Date): Date => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    // Handle seconds or milliseconds timestamps
    const msTimestamp = timestamp > 9999999999 ? timestamp : timestamp * 1000;
    return new Date(msTimestamp);
  };

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

  const loadNotes = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // Get all notes for the user
      const notesRef = collection(db, `users/${auth.currentUser.uid}/notes`);
      const notesSnapshot = await getDocs(query(notesRef));

      // Get all video titles
      const videoIds = new Set(notesSnapshot.docs.map(doc => doc.data().videoId));
      const videosRef = collection(db, 'videos');
      const videosSnapshot = await getDocs(query(videosRef));
      const videos = new Map(
        videosSnapshot.docs
          .filter(doc => videoIds.has(doc.id))
          .map(doc => [doc.id, { title: doc.data().title, subjectId: doc.data().subjectId }])
      );

      // Get subject names
      const subjectIds = new Set([...videos.values()].map(v => v.subjectId));
      const subjectsRef = collection(db, 'subjects');
      const subjectsSnapshot = await getDocs(subjectsRef);
      const subjects = new Map(
        subjectsSnapshot.docs
          .filter(doc => subjectIds.has(doc.id))
          .map(doc => [doc.id, doc.data().name])
      );

      // Combine all data
      const notesData = notesSnapshot.docs.map(doc => {
        const note = doc.data();
        const video = videos.get(note.videoId);
        return {
          id: doc.id,
          videoId: note.videoId,
          videoTitle: video?.title || 'Unknown Video',
          subjectName: video ? subjects.get(video.subjectId) || 'Unknown Subject' : 'Unknown Subject',
          content: note.content,
          timestamp: note.timestamp || 0,
          createdAt: formatTimestamp(note.createdAt || new Date()),
        };
      });

      setNotes(notesData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Error loading notes:', error);
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!auth.currentUser) return;

    try {
      const noteRef = doc(db, `users/${auth.currentUser.uid}/notes/${noteId}`);
      await deleteDoc(noteRef);
      setNotes(prev => prev.filter(note => note.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleShareNote = async (note: Note) => {
    try {
      const noteText = [
        '📝 Video Note',
        '',
        note.content,
        '',
        `📺 From: ${note.videoTitle}`,
        `⏱️ At: ${formatVideoTimestamp(note.timestamp)}`,
        `📚 Subject: ${note.subjectName}`,
        `📅 Created: ${note.createdAt.toLocaleDateString()}`,
      ].join('\n');

      await Share.share({
        message: noteText,
      });
    } catch (error) {
      console.error('Error sharing note:', error);
    }
  };

  const renderNoteRow = ({ item: note }: { item: Note }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/video/${note.videoId}?timestamp=${note.timestamp}`)}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            <Ionicons name="document-text-outline" size={16} color="#666" />
            <Text style={styles.noteText} numberOfLines={2}>
              {note.content}
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShareNote(note)}
            >
              <Ionicons name="share-outline" size={16} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteNote(note.id)}
            >
              <Ionicons name="trash-outline" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {note.subjectName} • From {note.videoTitle} • {formatVideoTimestamp(note.timestamp)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
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
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 4,
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
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    padding: 16,
    textAlign: 'center',
  },
}); 