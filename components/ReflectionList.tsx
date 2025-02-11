import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from '../types/video';
import { auth, db } from '../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface Note {
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
}

interface ReflectionListProps {
  videos: Video[];
}

export default function ReflectionList({ videos }: ReflectionListProps) {
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [notes, setNotes] = useState<{[key: string]: Note}>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      loadNotes();
    }
  }, []);

  const loadNotes = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading reflections...</Text>
      </View>
    );
  }

  const videosWithReflections = videos.filter(video => {
    const note = notes[video.id];
    return note && (
      note.content ||
      note.keyTakeaways?.length > 0 ||
      note.reflections.understanding.length > 0 ||
      note.reflections.gaps.length > 0 ||
      note.reflections.applications.length > 0 ||
      note.reflections.connections.length > 0
    );
  });

  return (
    <ScrollView style={styles.container}>
      {videosWithReflections.map(video => {
        const note = notes[video.id];
        return (
          <View key={video.id} style={styles.videoSection}>
            <TouchableOpacity
              style={styles.videoHeader}
              onPress={() => setExpandedVideoId(
                expandedVideoId === video.id ? null : video.id
              )}
            >
              <View>
                <Text style={styles.videoTitle}>{video.title}</Text>
                <Text style={styles.lastUpdated}>
                  Updated {note.updatedAt.toLocaleDateString()}
                </Text>
              </View>
              <Ionicons
                name={expandedVideoId === video.id ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            {expandedVideoId === video.id && note && (
              <View style={styles.reflectionContent}>
                {note.content && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Notes</Text>
                    <Text style={styles.content}>{note.content}</Text>
                  </View>
                )}

                {note.keyTakeaways?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Key Takeaways</Text>
                    {note.keyTakeaways.map((point, index) => (
                      <View key={index} style={styles.point}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {note.reflections.understanding.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Understanding</Text>
                    {note.reflections.understanding.map((point, index) => (
                      <View key={index} style={styles.point}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {note.reflections.gaps.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Knowledge Gaps</Text>
                    {note.reflections.gaps.map((point, index) => (
                      <View key={index} style={styles.point}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {note.reflections.applications.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Applications</Text>
                    {note.reflections.applications.map((point, index) => (
                      <View key={index} style={styles.point}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {note.reflections.connections.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connections</Text>
                    {note.reflections.connections.map((point, index) => (
                      <View key={index} style={styles.point}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {videosWithReflections.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="journal-outline" size={48} color="#666" />
          <Text style={styles.emptyTitle}>No Reflections Yet</Text>
          <Text style={styles.emptyText}>
            Start watching videos and add your reflections to track your learning journey
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  videoSection: {
    backgroundColor: '#222',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666',
  },
  reflectionContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  content: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  point: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    color: '#666',
    marginRight: 8,
    fontSize: 16,
  },
  pointText: {
    flex: 1,
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
}); 