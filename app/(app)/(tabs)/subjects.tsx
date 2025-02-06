import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Subject, GraphData } from '../../../types/video';
import { SubjectService } from '../../../services/firebase/subjects';
import { auth } from '../../../services/firebase';
import { router } from 'expo-router';
import { Svg, Circle, Line, G, Text as SvgText } from 'react-native-svg';

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 10;
const CARD_WIDTH = (WINDOW_WIDTH - (CARD_MARGIN * 4)) / 2;

interface KnowledgeGraphPreviewProps {
  data: GraphData;
  width: number;
  height: number;
}

const KnowledgeGraphPreview: React.FC<KnowledgeGraphPreviewProps> = ({ data, width, height }) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2.5;
  const nodePositions = new Map();

  // Find root nodes (nodes with no incoming edges)
  const hasIncomingEdge = new Set(data.edges.map(edge => edge.target));
  const rootNodes = data.nodes.filter(node => !hasIncomingEdge.has(node.id));

  // Position root nodes at the top
  rootNodes.forEach((node, index) => {
    const x = centerX + (index - (rootNodes.length - 1) / 2) * (radius / 1.5);
    nodePositions.set(node.id, {
      x,
      y: centerY - radius / 2
    });
  });

  // Position child nodes below their parents
  const positionedNodes = new Set(rootNodes.map(n => n.id));
  let level = 1;
  
  while (positionedNodes.size < data.nodes.length && level < 3) {
    data.edges.forEach(edge => {
      if (positionedNodes.has(edge.source) && !positionedNodes.has(edge.target)) {
        const parentPos = nodePositions.get(edge.source);
        const siblingCount = data.edges.filter(e => e.source === edge.source).length;
        const siblingIndex = data.edges.filter(e => e.source === edge.source && e.target <= edge.target).length;
        
        nodePositions.set(edge.target, {
          x: parentPos.x + (siblingIndex - (siblingCount - 1) / 2) * (radius / 2),
          y: parentPos.y + radius / 2
        });
        positionedNodes.add(edge.target);
      }
    });
    level++;
  }

  // Position any remaining nodes in a circle
  data.nodes.forEach(node => {
    if (!nodePositions.has(node.id)) {
      const angle = Math.random() * 2 * Math.PI;
      nodePositions.set(node.id, {
        x: centerX + radius * Math.cos(angle) / 2,
        y: centerY + radius * Math.sin(angle) / 2
      });
    }
  });

  return (
    <Svg width={width} height={height}>
      {/* Draw edges */}
      {data.edges.map((edge, index) => {
        const source = nodePositions.get(edge.source);
        const target = nodePositions.get(edge.target);
        return (
          <G key={`edge-${index}`}>
            <Line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="#444"
              strokeWidth={2}
            />
            {/* Draw arrow */}
            <Circle
              cx={(source.x + target.x) / 2}
              cy={(source.y + target.y) / 2}
              r={3}
              fill="#444"
            />
          </G>
        );
      })}

      {/* Draw nodes */}
      {data.nodes.map((node, index) => {
        const pos = nodePositions.get(node.id);
        const isRoot = rootNodes.includes(node);
        const nodeSize = isRoot ? 10 : 8;
        
        return (
          <G key={`node-${index}`}>
            {/* Node background for contrast */}
            <Circle
              cx={pos.x}
              cy={pos.y}
              r={nodeSize + 3}
              fill="#111"
            />
            {/* Main node circle */}
            <Circle
              cx={pos.x}
              cy={pos.y}
              r={nodeSize}
              fill={isRoot ? '#2E7D32' : '#1a472a'}
              stroke="#333"
              strokeWidth={1.5}
            />
            {/* Label */}
            <SvgText
              x={pos.x}
              y={pos.y + nodeSize + 12}
              fill="#999"
              fontSize={10}
              textAnchor="middle"
            >
              {node.label.split(' ')[0]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
};

export default function SubjectsScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    if (!auth.currentUser) {
      console.log('No authenticated user found');
      return;
    }

    try {
      console.log('Loading subjects for user:', auth.currentUser.uid);
      setLoading(true);
      setError(null);
      const fetchedSubjects = await SubjectService.getSubjects(auth.currentUser.uid);
      console.log('Fetched subjects:', fetchedSubjects);
      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error('Error loading subjects:', error);
      setError('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text: string) => {
    if (!auth.currentUser) return;
    
    setSearchQuery(text);
    if (!text) {
      loadSubjects();
      return;
    }

    try {
      setLoading(true);
      const searchResults = await SubjectService.searchSubjects(text, auth.currentUser.uid);
      setSubjects(searchResults);
    } catch (error) {
      console.error('Error searching subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = (progress: number) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
    </View>
  );

  const renderSubjectCard = (subject: Subject) => (
    <TouchableOpacity 
      key={subject.id}
      style={styles.card}
      onPress={() => router.push(`/subject/${subject.id}`)}
    >
      <Text style={styles.cardTitle}>{subject.name}</Text>
      {renderProgressBar(subject.progress)}
      <Text style={styles.progressText}>{subject.progress}% Complete</Text>
      <Text style={styles.statsText}>
        {subject.completedVideos} / {subject.videosCount} videos watched
      </Text>
      <View style={styles.graphContainer}>
        <KnowledgeGraphPreview 
          data={subject.knowledgeGraph}
          width={CARD_WIDTH}
          height={140}
        />
      </View>
    </TouchableOpacity>
  );

  if (loading && !subjects.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSubjects}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Subjects</Text>
        <Text style={styles.subtitle}>Explore learning categories</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search subjects..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
      >
        {subjects.map(renderSubjectCard)}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    margin: 20,
    marginTop: 0,
    borderRadius: 10,
    padding: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: CARD_MARGIN,
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 15,
    marginBottom: CARD_MARGIN * 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1a472a',
  },
  progressText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  graphContainer: {
    height: 140,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
}); 