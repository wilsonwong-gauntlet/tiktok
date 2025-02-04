import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import { Video } from '../types/video';
import { ResizeMode, Video as ExpoVideo } from 'expo-av';

interface VideoCardProps {
  video: Video;
}

const { width, height } = Dimensions.get('window');

export default function VideoCard({ video }: VideoCardProps) {
  return (
    <View style={styles.container}>
      <ExpoVideo
        source={{ uri: video.url }}
        style={styles.video}
        useNativeControls
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={false}
      />
      
      <View style={styles.overlay}>
        <View style={styles.metadata}>
          <Text style={styles.title}>{video.title}</Text>
          <Text style={styles.author}>{video.authorName}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {video.description}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>AI Summary</Text>
          </TouchableOpacity>
          
          {video.furtherReading && video.furtherReading.length > 0 && (
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>Further Reading</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  metadata: {
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  author: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  description: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  actions: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 