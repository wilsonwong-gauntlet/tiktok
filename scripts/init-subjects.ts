import { db } from './firebase-admin';
import { Subject } from '../types/video';

const SUBJECTS_COLLECTION = 'subjects';

const sampleSubjects: Partial<Subject>[] = [
  {
    name: 'Computer Science',
    description: 'Study of computation, algorithms, programming languages, and computer systems.',
    progress: 0,
    prerequisites: [],
    videosCount: 30,
    completedVideos: 0
  },
  {
    name: 'Biology',
    description: 'Explore living organisms, their structures, functions, evolution, and interactions with the environment.',
    progress: 0,
    prerequisites: [],
    videosCount: 25,
    completedVideos: 0
  },
  {
    name: 'Physics',
    description: 'Understanding the fundamental laws that govern the universe, from particles to cosmic phenomena.',
    progress: 0,
    prerequisites: [],
    videosCount: 28,
    completedVideos: 0
  },
  {
    name: 'Mathematics',
    description: 'Study of numbers, quantities, shapes, and patterns through abstract reasoning and logic.',
    progress: 0,
    prerequisites: [],
    videosCount: 32,
    completedVideos: 0
  },
  {
    name: 'Chemistry',
    description: 'Study of matter, its properties, composition, structure, and transformations.',
    progress: 0,
    prerequisites: [],
    videosCount: 26,
    completedVideos: 0
  },
  {
    name: 'Engineering',
    description: 'Application of scientific and mathematical principles to design, build, and optimize solutions.',
    progress: 0,
    prerequisites: [],
    videosCount: 28,
    completedVideos: 0
  },
  {
    name: 'History',
    description: 'Study of past events, civilizations, and their impact on human development and society.',
    progress: 0,
    prerequisites: [],
    videosCount: 24,
    completedVideos: 0
  },
  {
    name: 'Economics',
    description: 'Study of production, distribution, and consumption of goods and services, and how economies work.',
    progress: 0,
    prerequisites: [],
    videosCount: 26,
    completedVideos: 0
  },
  {
    name: 'Psychology',
    description: 'Understanding human behavior, mental processes, and factors influencing thoughts and actions.',
    progress: 0,
    prerequisites: [],
    videosCount: 28,
    completedVideos: 0
  },
  {
    name: 'Philosophy',
    description: 'Exploration of fundamental questions about existence, knowledge, values, reason, and reality.',
    progress: 0,
    prerequisites: [],
    videosCount: 25,
    completedVideos: 0
  }
];

async function initializeSubjects() {
  try {
    const batch = db.batch();
    const subjectsRef = db.collection(SUBJECTS_COLLECTION);

    // First, clear existing subjects
    const existingSubjects = await subjectsRef.get();
    existingSubjects.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new sample subjects
    for (const subject of sampleSubjects) {
      const subjectRef = subjectsRef.doc();
      const subjectData = {
        ...subject,
        searchableText: [
          subject.name?.toLowerCase(),
          ...subject.description?.toLowerCase().split(' ') || []
        ]
      };
      
      batch.set(subjectRef, subjectData);
    }

    await batch.commit();
    console.log('Successfully initialized subjects');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing subjects:', error);
    process.exit(1);
  }
}

initializeSubjects(); 