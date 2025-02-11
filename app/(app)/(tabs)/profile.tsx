import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../../services/firebase';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Your learning journey</Text>
        </View>

        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#666" />
          </View>
          <Text style={styles.userName}>{auth.currentUser?.email || 'Learner'}</Text>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  userInfo: {
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  signOutButton: {
    margin: 20,
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '500',
  },
}); 