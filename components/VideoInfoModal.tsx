import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FurtherReading } from '../types/video';

interface VideoInfoModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  aiSummary?: string;
  furtherReading?: FurtherReading[];
  type: 'summary' | 'reading';
}

export default function VideoInfoModal({ 
  visible, 
  onClose, 
  title,
  aiSummary,
  furtherReading,
  type
}: VideoInfoModalProps) {
  const handleLinkPress = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {type === 'summary' ? 'AI Summary' : 'Further Reading'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.videoTitle}>{title}</Text>

          <ScrollView style={styles.content}>
            {type === 'summary' && aiSummary && (
              <Text style={styles.summaryText}>{aiSummary}</Text>
            )}

            {type === 'reading' && furtherReading && (
              <View style={styles.readingList}>
                {furtherReading.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.readingItem}
                    onPress={() => handleLinkPress(item.url)}
                  >
                    <Text style={styles.readingTitle}>{item.title}</Text>
                    {item.description && (
                      <Text style={styles.readingDescription}>{item.description}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '60%',
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  summaryText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  readingList: {
    gap: 15,
  },
  readingItem: {
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 10,
  },
  readingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  readingDescription: {
    color: '#ccc',
    fontSize: 14,
  },
}); 