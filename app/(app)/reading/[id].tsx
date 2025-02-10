import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FurtherReading } from '../../../types/video';
import { VideoService } from '../../../services/firebase/video';
import { SubjectService } from '../../../services/firebase/subjects';

interface ReadingResource extends FurtherReading {
  videoId: string;
  videoTitle: string;
  subjectName: string;
  keyPoints?: string[];
  relatedConcepts?: string[];
  externalLinks?: Array<{
    title?: string;
    url: string;
  }>;
}

export default function ReadingResourceScreen() {
  const { id, videoId } = useLocalSearchParams();
  const [resource, setResource] = useState<ReadingResource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResource();
  }, [id, videoId]);

  const loadResource = async () => {
    try {
      setLoading(true);
      const video = await VideoService.fetchVideoById(videoId as string);
      
      if (video && video.furtherReading) {
        const matchingResource = video.furtherReading.find((r: FurtherReading) => r.title === id);
        if (matchingResource) {
          const subject = await SubjectService.getSubjectById(video.subjectId, auth.currentUser?.uid || '');
          setResource({
            ...matchingResource,
            videoId: video.id,
            videoTitle: video.title,
            subjectName: subject?.name || 'General',
          });
        }
      }
    } catch (error) {
      console.error('Error loading reading resource:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Reading Resource</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading resource...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!resource) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Reading Resource</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Resource not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.log("Can't open URL:", url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Reading Resource</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.resourceHeader}>
          <Text style={styles.resourceTitle}>{resource.title}</Text>
          <Text style={styles.resourceAuthor}>by {resource.author}</Text>
          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="school-outline" size={16} color="#666" />
              <Text style={styles.tagText}>{resource.subjectName}</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="play-circle-outline" size={16} color="#666" />
              <Text style={styles.tagText}>From {resource.videoTitle}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{resource.description}</Text>
        </View>

        {resource.keyPoints && resource.keyPoints.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Points</Text>
            {resource.keyPoints.map((point, index) => (
              <View key={index} style={styles.point}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#1a472a" />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        )}

        {resource.relatedConcepts && resource.relatedConcepts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Related Concepts</Text>
            <View style={styles.conceptsGrid}>
              {resource.relatedConcepts.map((concept, index) => (
                <View key={index} style={styles.conceptTag}>
                  <Text style={styles.conceptText}>{concept}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {resource.externalLinks && resource.externalLinks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>External Links</Text>
            {resource.externalLinks.map((link, index) => (
              <TouchableOpacity
                key={index}
                style={styles.link}
                onPress={() => handleOpenLink(link.url)}
              >
                <Ionicons name="link-outline" size={20} color="#1a472a" />
                <Text style={styles.linkText}>{link.title || link.url}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={styles.watchButton}
          onPress={() => router.push(`/video/${resource.videoId}`)}
        >
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.watchButtonText}>Watch Source Video</Text>
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
  resourceHeader: {
    marginBottom: 24,
  },
  resourceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  resourceAuthor: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  pointText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  conceptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conceptTag: {
    backgroundColor: '#1a472a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  conceptText: {
    color: '#fff',
    fontSize: 14,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  linkText: {
    flex: 1,
    color: '#1a472a',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a472a',
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
  }
});
