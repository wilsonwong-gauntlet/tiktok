import { db } from './firebase-admin';

const VIDEOS_COLLECTION = 'videos';

const sampleVideos = [
  {
    title: 'Introduction to Machine Learning',
    description: 'A comprehensive overview of machine learning concepts and applications.',
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    duration: 120,
    createdAt: new Date(),
    tags: ['machine learning', 'AI', 'technology'],
    aiSummary: 'This video covers the basics of machine learning, including supervised and unsupervised learning.',
    searchableText: [
      'introduction',
      'machine',
      'learning',
      'comprehensive',
      'overview',
      'concepts',
      'applications',
      'technology',
      'ai',
      'artificial',
      'intelligence',
      'supervised',
      'unsupervised'
    ],
    furtherReading: [
      {
        title: 'Machine Learning Guide',
        url: 'https://example.com/ml-guide',
        description: 'A detailed guide to machine learning concepts'
      }
    ],
    quiz: {
      id: 'ml-intro-quiz',
      videoId: 'intro-to-ml',
      questions: [
        {
          id: 'q1',
          question: 'What is the main difference between supervised and unsupervised learning?',
          options: [
            'Supervised learning requires a GPU, unsupervised doesn\'t',
            'Supervised learning uses labeled data, unsupervised learning doesn\'t',
            'Supervised learning is faster than unsupervised learning',
            'There is no difference between them'
          ],
          correctOptionIndex: 1,
          explanation: 'Supervised learning uses labeled data to train models, while unsupervised learning finds patterns in unlabeled data.'
        },
        {
          id: 'q2',
          question: 'Which of these is an example of supervised learning?',
          options: [
            'Clustering customer groups',
            'Finding anomalies in data',
            'Email spam classification',
            'Dimensionality reduction'
          ],
          correctOptionIndex: 2,
          explanation: 'Email spam classification is a supervised learning task because it uses labeled examples of spam and non-spam emails.'
        }
      ]
    },
    viewCount: 0,
    authorId: 'sample-author',
    authorName: 'AI Learning Channel',
    subjectId: 'VRtalTBPzBiqRkFeEilq',
    conceptIds: ['sys-001', 'sys-002']
  },
  {
    title: 'Understanding Quantum Computing',
    description: 'Deep dive into quantum computing principles and applications.',
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    duration: 180,
    createdAt: new Date(),
    tags: ['quantum computing', 'physics', 'technology'],
    aiSummary: 'An exploration of quantum computing fundamentals and their potential impact.',
    searchableText: [
      'understanding',
      'quantum',
      'computing',
      'deep',
      'dive',
      'principles',
      'applications',
      'physics',
      'technology',
      'fundamentals',
      'impact'
    ],
    furtherReading: [
      {
        title: 'Quantum Computing Basics',
        url: 'https://example.com/quantum-guide',
        description: 'Introduction to quantum computing concepts'
      }
    ],
    viewCount: 0,
    authorId: 'sample-author',
    authorName: 'Quantum Physics Explained',
    subjectId: 'VRtalTBPzBiqRkFeEilq',
    conceptIds: ['sys-002', 'sys-003']
  }
];

async function resetSampleVideos() {
  try {
    // Clear existing videos
    console.log('Clearing existing videos...');
    const snapshot = await db.collection(VIDEOS_COLLECTION).get();
    const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    console.log('Cleared existing videos');

    // Add new sample videos
    console.log('Adding sample videos...');
    const addPromises = sampleVideos.map(video => db.collection(VIDEOS_COLLECTION).add(video));
    await Promise.all(addPromises);
    console.log('Added sample videos successfully');
  } catch (error) {
    console.error('Error resetting videos:', error);
    throw error;
  }
}

// Run the script
resetSampleVideos(); 