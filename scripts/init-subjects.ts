import { db } from './firebase-admin';
import { Subject } from '../types/video';

const SUBJECTS_COLLECTION = 'subjects';

const sampleSubjects: Partial<Subject>[] = [
  {
    name: 'Systems Theory',
    description: 'Understand how complex systems work, from organizations to ecosystems, through interdisciplinary analysis and pattern recognition.',
    progress: 0,
    concepts: [
      {
        id: 'sys-001',
        name: 'Emergence',
        description: 'How complex systems and patterns arise from simple rules and interactions.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'sys-002',
        name: 'Feedback Loops',
        description: 'Understanding positive and negative feedback mechanisms in systems.',
        status: 'not_started',
        prerequisites: ['sys-001']
      },
      {
        id: 'sys-003',
        name: 'System Dynamics',
        description: 'Analyzing how systems change over time and respond to interventions.',
        status: 'not_started',
        prerequisites: ['sys-002']
      }
    ],
    prerequisites: [],
    videosCount: 12,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'sys-001', label: 'Emergence', type: 'concept' },
        { id: 'sys-002', label: 'Feedback Loops', type: 'concept' },
        { id: 'sys-003', label: 'System Dynamics', type: 'concept' }
      ],
      edges: [
        { source: 'sys-001', target: 'sys-002' },
        { source: 'sys-002', target: 'sys-003' }
      ]
    }
  },
  {
    name: 'Game Theory',
    description: 'Explore strategic decision-making through mathematical models and logical analysis of competition and cooperation.',
    progress: 0,
    concepts: [
      {
        id: 'game-001',
        name: 'Nash Equilibrium',
        description: 'Understanding optimal strategies in competitive situations.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'game-002',
        name: 'Prisoner\'s Dilemma',
        description: 'Analyzing cooperation and betrayal in strategic situations.',
        status: 'not_started',
        prerequisites: ['game-001']
      }
    ],
    prerequisites: [],
    videosCount: 8,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'game-001', label: 'Nash Equilibrium', type: 'concept' },
        { id: 'game-002', label: 'Prisoner\'s Dilemma', type: 'concept' }
      ],
      edges: [
        { source: 'game-001', target: 'game-002' }
      ]
    }
  },
  {
    name: 'Cognitive Science',
    description: 'Investigate how the mind works through an interdisciplinary lens combining psychology, neuroscience, and computational theory.',
    progress: 0,
    concepts: [
      {
        id: 'cog-001',
        name: 'Mental Models',
        description: 'How we create and use internal representations of external reality.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'cog-002',
        name: 'Decision Theory',
        description: 'Understanding how humans make decisions and common cognitive biases.',
        status: 'not_started',
        prerequisites: ['cog-001']
      },
      {
        id: 'cog-003',
        name: 'Information Processing',
        description: 'How the brain processes, stores, and retrieves information.',
        status: 'not_started',
        prerequisites: ['cog-001']
      }
    ],
    prerequisites: [],
    videosCount: 15,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'cog-001', label: 'Mental Models', type: 'concept' },
        { id: 'cog-002', label: 'Decision Theory', type: 'concept' },
        { id: 'cog-003', label: 'Information Processing', type: 'concept' }
      ],
      edges: [
        { source: 'cog-001', target: 'cog-002' },
        { source: 'cog-001', target: 'cog-003' }
      ]
    }
  },
  {
    name: 'Formal Logic',
    description: 'Master the principles of valid reasoning and argumentation through symbolic logic and proof systems.',
    progress: 0,
    concepts: [
      {
        id: 'log-001',
        name: 'Propositional Logic',
        description: 'Basic logical operations and truth tables.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'log-002',
        name: 'Predicate Logic',
        description: 'Advanced logical expressions with quantifiers and variables.',
        status: 'not_started',
        prerequisites: ['log-001']
      },
      {
        id: 'log-003',
        name: 'Proof Theory',
        description: 'Methods for constructing and verifying logical proofs.',
        status: 'not_started',
        prerequisites: ['log-002']
      }
    ],
    prerequisites: [],
    videosCount: 10,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'log-001', label: 'Propositional Logic', type: 'concept' },
        { id: 'log-002', label: 'Predicate Logic', type: 'concept' },
        { id: 'log-003', label: 'Proof Theory', type: 'concept' }
      ],
      edges: [
        { source: 'log-001', target: 'log-002' },
        { source: 'log-002', target: 'log-003' }
      ]
    }
  },
  {
    name: 'Philosophy',
    description: 'Explore fundamental questions about existence, knowledge, values, reason, mind, and language.',
    progress: 0,
    concepts: [
      {
        id: 'phil-001',
        name: 'Epistemology',
        description: 'The theory of knowledge, especially with regard to its methods, validity, and scope.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'phil-002',
        name: 'Ethics',
        description: 'The study of moral principles and values that govern behavior.',
        status: 'not_started',
        prerequisites: []
      }
    ],
    prerequisites: [],
    videosCount: 10,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'phil-001', label: 'Epistemology', type: 'concept' },
        { id: 'phil-002', label: 'Ethics', type: 'concept' }
      ],
      edges: []
    }
  },
  {
    name: 'Programming',
    description: 'Learn the art and science of creating software through programming languages and computational thinking.',
    progress: 0,
    concepts: [
      {
        id: 'prog-001',
        name: 'Variables & Data Types',
        description: 'Understanding how to store and manipulate different types of data.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'prog-002',
        name: 'Control Flow',
        description: 'Managing program execution with conditions and loops.',
        status: 'not_started',
        prerequisites: ['prog-001']
      }
    ],
    prerequisites: [],
    videosCount: 15,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'prog-001', label: 'Variables & Data Types', type: 'concept' },
        { id: 'prog-002', label: 'Control Flow', type: 'concept' }
      ],
      edges: [
        { source: 'prog-001', target: 'prog-002' }
      ]
    }
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

    // Add new sample subjects and their concepts
    for (const subject of sampleSubjects) {
      // Create the subject document
      const subjectRef = subjectsRef.doc();
      const subjectData = {
        ...subject,
        searchableText: [
          subject.name?.toLowerCase(),
          ...subject.description?.toLowerCase().split(' ') || [],
          ...subject.concepts?.map(c => c.name.toLowerCase()) || []
        ]
      };
      
      // Remove concepts from the main document as they'll be in a subcollection
      const { concepts, ...subjectWithoutConcepts } = subjectData;
      batch.set(subjectRef, subjectWithoutConcepts);

      // Add concepts as a subcollection
      if (concepts) {
        for (const concept of concepts) {
          const conceptRef = subjectRef.collection('concepts').doc(concept.id);
          batch.set(conceptRef, {
            name: concept.name,
            description: concept.description,
            status: concept.status,
            prerequisites: concept.prerequisites,
            subjectId: subjectRef.id // Add reference to parent subject
          });
        }
      }
    }

    await batch.commit();
    console.log('Successfully initialized subjects and concepts');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing subjects:', error);
    process.exit(1);
  }
}

initializeSubjects(); 