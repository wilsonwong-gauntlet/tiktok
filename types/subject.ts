export interface Subject {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  color: string;
  courseCount: number;
  topics: string[];
  parentSubject?: string;  // For sub-categories
}

export const MAIN_SUBJECTS = {
  PHILOSOPHY: 'philosophy',
  COMPUTER_SCIENCE: 'computer_science',
  MATHEMATICS: 'mathematics',
  PHYSICS: 'physics',
  PSYCHOLOGY: 'psychology',
  ECONOMICS: 'economics',
  BIOLOGY: 'biology',
  HISTORY: 'history',
  LITERATURE: 'literature',
  ART: 'art',
} as const;

export type MainSubject = typeof MAIN_SUBJECTS[keyof typeof MAIN_SUBJECTS];

// Example subject data structure
export const SUBJECT_DATA: Record<MainSubject, Subject> = {
  philosophy: {
    id: 'philosophy',
    name: 'Philosophy',
    description: 'Explore fundamental questions about existence, knowledge, values, reason, mind, and language.',
    imageUrl: 'https://example.com/philosophy.jpg', // We'll update these with real images
    color: '#7C4DFF',
    courseCount: 150,
    topics: ['Ethics', 'Logic', 'Metaphysics', 'Epistemology', 'Political Philosophy', 'Aesthetics']
  },
  computer_science: {
    id: 'computer_science',
    name: 'Computer Science',
    description: 'Study of computation, automation, and information.',
    imageUrl: 'https://example.com/cs.jpg',
    color: '#00BCD4',
    courseCount: 425,
    topics: ['Programming', 'Algorithms', 'Data Structures', 'AI', 'Machine Learning', 'Databases']
  },
  mathematics: {
    id: 'mathematics',
    name: 'Mathematics',
    description: 'The science of patterns, structure, and logical relationships.',
    imageUrl: 'https://example.com/math.jpg',
    color: '#F44336',
    courseCount: 300,
    topics: ['Calculus', 'Algebra', 'Geometry', 'Statistics', 'Number Theory', 'Topology']
  },
  physics: {
    id: 'physics',
    name: 'Physics',
    description: 'Study of matter, energy, and the fundamental forces of nature.',
    imageUrl: 'https://example.com/physics.jpg',
    color: '#2196F3',
    courseCount: 200,
    topics: ['Mechanics', 'Quantum Physics', 'Relativity', 'Thermodynamics', 'Electromagnetism']
  },
  psychology: {
    id: 'psychology',
    name: 'Psychology',
    description: 'Study of mind and behavior.',
    imageUrl: 'https://example.com/psychology.jpg',
    color: '#FF9800',
    courseCount: 180,
    topics: ['Cognitive Psychology', 'Social Psychology', 'Clinical Psychology', 'Developmental Psychology']
  },
  economics: {
    id: 'economics',
    name: 'Economics',
    description: 'Study of production, distribution, and consumption of goods and services.',
    imageUrl: 'https://example.com/economics.jpg',
    color: '#4CAF50',
    courseCount: 175,
    topics: ['Microeconomics', 'Macroeconomics', 'International Economics', 'Behavioral Economics']
  },
  biology: {
    id: 'biology',
    name: 'Biology',
    description: 'Study of life and living organisms.',
    imageUrl: 'https://example.com/biology.jpg',
    color: '#8BC34A',
    courseCount: 250,
    topics: ['Genetics', 'Ecology', 'Cell Biology', 'Evolution', 'Physiology']
  },
  history: {
    id: 'history',
    name: 'History',
    description: 'Study of past events and their impact on human civilization.',
    imageUrl: 'https://example.com/history.jpg',
    color: '#795548',
    courseCount: 200,
    topics: ['Ancient History', 'Modern History', 'World History', 'Art History']
  },
  literature: {
    id: 'literature',
    name: 'Literature',
    description: 'Study of written works and their cultural significance.',
    imageUrl: 'https://example.com/literature.jpg',
    color: '#9C27B0',
    courseCount: 150,
    topics: ['Classical Literature', 'Modern Literature', 'Poetry', 'Drama']
  },
  art: {
    id: 'art',
    name: 'Art',
    description: 'Study of visual, performing, and conceptual arts.',
    imageUrl: 'https://example.com/art.jpg',
    color: '#FF4081',
    courseCount: 175,
    topics: ['Painting', 'Sculpture', 'Photography', 'Digital Art', 'Art History']
  }
}; 