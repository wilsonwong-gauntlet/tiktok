import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../../../services/firebase';
import { Note } from '../../../../types/video';
import { VideoService } from '../../../../services/firebase/video';
import { SubjectService } from '../../../../services/firebase/subjects';
import { getNoteForVideo } from '../../../../services/firebase/learning';

interface NoteDetails extends Note {
  videoTitle: string;
  subjectName: string;
  timestamp?: number;
}

export default function NoteDetailsScreen() {
  const { id, videoId } = useLocalSearchParams();
  const [note, setNote] = useState<NoteDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNote();
  }, [id, videoId]);

  const loadNote = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const [video, noteData] = await Promise.all([
        VideoService.fetchVideoById(videoId as string),
        getNoteForVideo(auth.currentUser.uid, videoId as string)
      ]);
      
      if (video && noteData) {
        const subject = await SubjectService.getSubjectById(video.subjectId, auth.currentUser.uid);
        setNote({
          ...noteData,
          videoTitle: video.title,
          subjectName: subject?.name || 'General',
        });
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Note Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading note...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Note Details</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Note not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Note Details</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.noteHeader}>
          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="school-outline" size={16} color="#666" />
              <Text style={styles.tagText}>{note.subjectName}</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="play-circle-outline" size={16} color="#666" />
              <Text style={styles.tagText}>From {note.videoTitle}</Text>
            </View>
            {note.timestamp && (
              <View style={styles.tag}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.tagText}>At {formatVideoTimestamp(note.timestamp)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.dateText}>
            Created {note.createdAt.toLocaleDateString()}
            {note.updatedAt && note.updatedAt > note.createdAt && 
              ` • Updated ${note.updatedAt.toLocaleDateString()}`
            }
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Capture</Text>
          <View style={styles.contentCard}>
            <Text style={styles.contentText}>{note.content}</Text>
          </View>
        </View>

        {note.keyTakeaways && note.keyTakeaways.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Takeaways</Text>
            {note.keyTakeaways.map((takeaway, index) => (
              <View key={index} style={styles.takeawayCard}>
                <Ionicons name="bulb-outline" size={20} color="#9580FF" />
                <Text style={styles.takeawayText}>{takeaway}</Text>
              </View>
            ))}
          </View>
        )}

        {note.reflections && Object.entries(note.reflections).map(([key, points]) => 
          points.length > 0 && (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
              {points.map((point, index) => (
                <View key={index} style={styles.reflectionCard}>
                  <Text style={styles.reflectionText}>{point}</Text>
                </View>
              ))}
            </View>
          )
        )}

        <TouchableOpacity 
          style={styles.watchButton}
          onPress={() => router.push(`/video/${note.videoId}?timestamp=${note.timestamp || 0}`)}
        >
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.watchButtonText}>Watch Video at Timestamp</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  noteHeader: {
    marginBottom: 24,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    color: '#666',
    fontSize: 14,
  },
  dateText: {
    color: '#666',
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  contentCard: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
  },
  contentText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  takeawayCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  takeawayText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  reflectionCard: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  reflectionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9580FF',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 32,
  },
  watchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4444',
  },
}); 