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
  },
  {
    name: 'Mathematics',
    description: 'Explore the fundamental concepts of mathematics, from algebra and calculus to advanced topics in mathematical analysis.',
    progress: 0,
    concepts: [
      {
        id: 'math-001',
        name: 'Algebra',
        description: 'Study of mathematical symbols and the rules for manipulating these symbols.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'math-002',
        name: 'Calculus',
        description: 'Understanding rates of change and accumulation through derivatives and integrals.',
        status: 'not_started',
        prerequisites: ['math-001']
      },
      {
        id: 'math-003',
        name: 'Linear Algebra',
        description: 'Study of linear equations and linear functions.',
        status: 'not_started',
        prerequisites: ['math-001']
      }
    ],
    prerequisites: [],
    videosCount: 20,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'math-001', label: 'Algebra', type: 'concept' },
        { id: 'math-002', label: 'Calculus', type: 'concept' },
        { id: 'math-003', label: 'Linear Algebra', type: 'concept' }
      ],
      edges: [
        { source: 'math-001', target: 'math-002' },
        { source: 'math-001', target: 'math-003' }
      ]
    }
  },
  {
    name: 'Data Science',
    description: 'Learn to analyze and interpret complex data sets using statistical methods and machine learning techniques.',
    progress: 0,
    concepts: [
      {
        id: 'data-001',
        name: 'Statistical Analysis',
        description: 'Understanding probability, distributions, and statistical inference.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'data-002',
        name: 'Machine Learning',
        description: 'Introduction to algorithms that can learn from and make predictions on data.',
        status: 'not_started',
        prerequisites: ['data-001']
      },
      {
        id: 'data-003',
        name: 'Data Visualization',
        description: 'Techniques for effectively communicating data insights through visual representations.',
        status: 'not_started',
        prerequisites: ['data-001']
      }
    ],
    prerequisites: ['Mathematics'],
    videosCount: 18,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'data-001', label: 'Statistical Analysis', type: 'concept' },
        { id: 'data-002', label: 'Machine Learning', type: 'concept' },
        { id: 'data-003', label: 'Data Visualization', type: 'concept' }
      ],
      edges: [
        { source: 'data-001', target: 'data-002' },
        { source: 'data-001', target: 'data-003' }
      ]
    }
  },
  {
    name: 'Psychology',
    description: 'Explore human behavior, mental processes, and the factors that influence our thoughts and actions.',
    progress: 0,
    concepts: [
      {
        id: 'psych-001',
        name: 'Cognitive Psychology',
        description: 'Study of mental processes including thinking, memory, and learning.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'psych-002',
        name: 'Social Psychology',
        description: 'Understanding how people interact and influence each other.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'psych-003',
        name: 'Behavioral Psychology',
        description: 'Analysis of observable behaviors and their environmental triggers.',
        status: 'not_started',
        prerequisites: ['psych-001']
      }
    ],
    prerequisites: [],
    videosCount: 15,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'psych-001', label: 'Cognitive Psychology', type: 'concept' },
        { id: 'psych-002', label: 'Social Psychology', type: 'concept' },
        { id: 'psych-003', label: 'Behavioral Psychology', type: 'concept' }
      ],
      edges: [
        { source: 'psych-001', target: 'psych-003' }
      ]
    }
  },
  {
    name: 'Economics',
    description: 'Study how societies allocate scarce resources and make decisions in markets and economies.',
    progress: 0,
    concepts: [
      {
        id: 'econ-001',
        name: 'Microeconomics',
        description: 'Analysis of individual markets, consumer behavior, and firm decision-making.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'econ-002',
        name: 'Macroeconomics',
        description: 'Study of economy-wide phenomena like inflation, growth, and unemployment.',
        status: 'not_started',
        prerequisites: ['econ-001']
      },
      {
        id: 'econ-003',
        name: 'Behavioral Economics',
        description: 'Understanding psychological influences on economic decisions.',
        status: 'not_started',
        prerequisites: ['econ-001']
      }
    ],
    prerequisites: [],
    videosCount: 16,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'econ-001', label: 'Microeconomics', type: 'concept' },
        { id: 'econ-002', label: 'Macroeconomics', type: 'concept' },
        { id: 'econ-003', label: 'Behavioral Economics', type: 'concept' }
      ],
      edges: [
        { source: 'econ-001', target: 'econ-002' },
        { source: 'econ-001', target: 'econ-003' }
      ]
    }
  },
  {
    name: 'Artificial Intelligence',
    description: 'Explore the theory and application of creating intelligent machines that can simulate human intelligence.',
    progress: 0,
    concepts: [
      {
        id: 'ai-001',
        name: 'Neural Networks',
        description: 'Understanding the architecture and training of artificial neural networks.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'ai-002',
        name: 'Natural Language Processing',
        description: 'Techniques for processing and understanding human language.',
        status: 'not_started',
        prerequisites: ['ai-001']
      },
      {
        id: 'ai-003',
        name: 'Computer Vision',
        description: 'Methods for enabling computers to understand and process visual information.',
        status: 'not_started',
        prerequisites: ['ai-001']
      }
    ],
    prerequisites: ['Programming', 'Mathematics'],
    videosCount: 20,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'ai-001', label: 'Neural Networks', type: 'concept' },
        { id: 'ai-002', label: 'Natural Language Processing', type: 'concept' },
        { id: 'ai-003', label: 'Computer Vision', type: 'concept' }
      ],
      edges: [
        { source: 'ai-001', target: 'ai-002' },
        { source: 'ai-001', target: 'ai-003' }
      ]
    }
  },
  {
    name: 'Physics',
    description: 'Understand the fundamental laws that govern the universe, from subatomic particles to cosmic phenomena.',
    progress: 0,
    concepts: [
      {
        id: 'phys-001',
        name: 'Classical Mechanics',
        description: 'Study of motion and forces in everyday situations.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'phys-002',
        name: 'Quantum Mechanics',
        description: 'Physics of atomic and subatomic systems.',
        status: 'not_started',
        prerequisites: ['phys-001']
      },
      {
        id: 'phys-003',
        name: 'Relativity',
        description: 'Understanding space, time, and gravity at cosmic scales.',
        status: 'not_started',
        prerequisites: ['phys-001']
      }
    ],
    prerequisites: ['Mathematics'],
    videosCount: 25,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'phys-001', label: 'Classical Mechanics', type: 'concept' },
        { id: 'phys-002', label: 'Quantum Mechanics', type: 'concept' },
        { id: 'phys-003', label: 'Relativity', type: 'concept' }
      ],
      edges: [
        { source: 'phys-001', target: 'phys-002' },
        { source: 'phys-001', target: 'phys-003' }
      ]
    }
  },
  {
    name: 'Biology',
    description: 'Study life and living organisms, from molecular processes to ecosystems and evolution.',
    progress: 0,
    concepts: [
      {
        id: 'bio-001',
        name: 'Cell Biology',
        description: 'Understanding the basic unit of life and cellular processes.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'bio-002',
        name: 'Genetics',
        description: 'Study of heredity and variation in living organisms.',
        status: 'not_started',
        prerequisites: ['bio-001']
      },
      {
        id: 'bio-003',
        name: 'Evolution',
        description: 'Understanding how species change over time through natural selection.',
        status: 'not_started',
        prerequisites: ['bio-002']
      }
    ],
    prerequisites: [],
    videosCount: 22,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'bio-001', label: 'Cell Biology', type: 'concept' },
        { id: 'bio-002', label: 'Genetics', type: 'concept' },
        { id: 'bio-003', label: 'Evolution', type: 'concept' }
      ],
      edges: [
        { source: 'bio-001', target: 'bio-002' },
        { source: 'bio-002', target: 'bio-003' }
      ]
    }
  },
  {
    name: 'Chemistry',
    description: 'Explore the composition, structure, properties, and transformation of matter.',
    progress: 0,
    concepts: [
      {
        id: 'chem-001',
        name: 'Atomic Structure',
        description: 'Understanding the building blocks of matter.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'chem-002',
        name: 'Chemical Bonding',
        description: 'How atoms combine to form molecules and compounds.',
        status: 'not_started',
        prerequisites: ['chem-001']
      },
      {
        id: 'chem-003',
        name: 'Reactions & Kinetics',
        description: 'Study of chemical reactions and their rates.',
        status: 'not_started',
        prerequisites: ['chem-002']
      }
    ],
    prerequisites: ['Mathematics'],
    videosCount: 20,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'chem-001', label: 'Atomic Structure', type: 'concept' },
        { id: 'chem-002', label: 'Chemical Bonding', type: 'concept' },
        { id: 'chem-003', label: 'Reactions & Kinetics', type: 'concept' }
      ],
      edges: [
        { source: 'chem-001', target: 'chem-002' },
        { source: 'chem-002', target: 'chem-003' }
      ]
    }
  },
  {
    name: 'Computer Networks',
    description: 'Learn about the principles and protocols that enable communication between computers and devices.',
    progress: 0,
    concepts: [
      {
        id: 'net-001',
        name: 'Network Fundamentals',
        description: 'Basic concepts of computer networking and protocols.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'net-002',
        name: 'Internet Protocols',
        description: 'Understanding TCP/IP and other core internet protocols.',
        status: 'not_started',
        prerequisites: ['net-001']
      },
      {
        id: 'net-003',
        name: 'Network Security',
        description: 'Protecting networks from threats and ensuring data privacy.',
        status: 'not_started',
        prerequisites: ['net-002']
      }
    ],
    prerequisites: ['Programming'],
    videosCount: 15,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'net-001', label: 'Network Fundamentals', type: 'concept' },
        { id: 'net-002', label: 'Internet Protocols', type: 'concept' },
        { id: 'net-003', label: 'Network Security', type: 'concept' }
      ],
      edges: [
        { source: 'net-001', target: 'net-002' },
        { source: 'net-002', target: 'net-003' }
      ]
    }
  },
  {
    name: 'Design Thinking',
    description: 'Master the human-centered approach to innovation and problem-solving through design methodology.',
    progress: 0,
    concepts: [
      {
        id: 'des-001',
        name: 'Empathy & Research',
        description: 'Understanding user needs through research and observation.',
        status: 'not_started',
        prerequisites: []
      },
      {
        id: 'des-002',
        name: 'Ideation & Prototyping',
        description: 'Generating and testing solutions through rapid prototyping.',
        status: 'not_started',
        prerequisites: ['des-001']
      },
      {
        id: 'des-003',
        name: 'Implementation',
        description: 'Bringing solutions to life and measuring impact.',
        status: 'not_started',
        prerequisites: ['des-002']
      }
    ],
    prerequisites: [],
    videosCount: 12,
    completedVideos: 0,
    knowledgeGraph: {
      nodes: [
        { id: 'des-001', label: 'Empathy & Research', type: 'concept' },
        { id: 'des-002', label: 'Ideation & Prototyping', type: 'concept' },
        { id: 'des-003', label: 'Implementation', type: 'concept' }
      ],
      edges: [
        { source: 'des-001', target: 'des-002' },
        { source: 'des-002', target: 'des-003' }
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