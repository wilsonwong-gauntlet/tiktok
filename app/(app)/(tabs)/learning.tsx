import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LearningScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>My Learning</Text>
          <Text style={styles.subtitle}>Track your progress</Text>
        </View>

        <View style={styles.overview}>
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Weekly Goal</Text>
            <Text style={styles.statsValue}>0/10 hours</Text>
          </View>
          
          <View style={styles.streakCard}>
            <Text style={styles.streakTitle}>Learning Streak</Text>
            <Text style={styles.streakValue}>🔥 0 days</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Subjects</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Subject progress coming soon...</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Activity feed coming soon...</Text>
          </View>
        </View>
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
  overview: {
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'space-between',
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 10,
    marginRight: 5,
  },
  streakCard: {
    flex: 1,
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 10,
    marginLeft: 5,
  },
  statsTitle: {
    color: '#666',
    fontSize: 14,
  },
  statsValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
  },
  streakTitle: {
    color: '#666',
    fontSize: 14,
  },
  streakValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  placeholder: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
  },
}); 