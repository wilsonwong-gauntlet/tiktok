import { 
  collection, 
  query, 
  getDocs,
  doc,
  getDoc,
  where,
  orderBy,
  limit 
} from 'firebase/firestore';
import { db } from './index';
import { Subject, UserProgress, Concept } from '../../types/video';

const SUBJECTS_COLLECTION = 'subjects';
const USER_PROGRESS_COLLECTION = 'userProgress';

export class SubjectService {
  static async getSubjects(userId: string): Promise<Subject[]> {
    try {
      console.log('Getting subjects for user:', userId);
      
      // Get all subjects
      const subjectsRef = collection(db, SUBJECTS_COLLECTION);
      console.log('Fetching subjects from collection:', SUBJECTS_COLLECTION);
      const subjectsSnapshot = await getDocs(subjectsRef);
      console.log('Found subjects:', subjectsSnapshot.size);
      
      const subjects = subjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subject[];
      console.log('Mapped subjects:', subjects);

      // Get user progress
      const userProgressRef = doc(db, USER_PROGRESS_COLLECTION, userId);
      console.log('Fetching user progress from:', USER_PROGRESS_COLLECTION);
      const userProgressDoc = await getDoc(userProgressRef);
      const userProgress = userProgressDoc.data() as UserProgress;
      console.log('User progress:', userProgress);

      // Merge subject data with user progress
      const mergedSubjects = subjects.map(subject => ({
        ...subject,
        progress: userProgress?.subjects[subject.id]?.progress || 0,
        completedVideos: userProgress?.subjects[subject.id]?.completedVideos?.length || 0
      }));
      console.log('Merged subjects with progress:', mergedSubjects);

      return mergedSubjects;
    } catch (error) {
      console.error('Error fetching subjects:', error);
      throw error;
    }
  }

  static async getSubjectById(subjectId: string, userId: string): Promise<Subject | null> {
    try {
      // Get main subject document
      const subjectRef = doc(db, SUBJECTS_COLLECTION, subjectId);
      const subjectDoc = await getDoc(subjectRef);
      
      if (!subjectDoc.exists()) {
        return null;
      }

      // Get concepts from subcollection
      const conceptsRef = collection(db, `${SUBJECTS_COLLECTION}/${subjectId}/concepts`);
      const conceptsSnapshot = await getDocs(conceptsRef);
      const concepts = conceptsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Concept[];

      // Get the main subject data including knowledge graph
      const subjectData = subjectDoc.data();
      const subject = {
        id: subjectDoc.id,
        name: subjectData.name,
        description: subjectData.description,
        prerequisites: subjectData.prerequisites || [],
        videosCount: subjectData.videosCount || 0,
        completedVideos: 0,
        knowledgeGraph: subjectData.knowledgeGraph || {
          nodes: [],
          edges: []
        },
        concepts,
        progress: 0
      } as Subject;

      // Get user progress for this subject
      const userProgressRef = doc(db, USER_PROGRESS_COLLECTION, userId);
      const userProgressDoc = await getDoc(userProgressRef);
      const userProgress = userProgressDoc.data() as UserProgress;

      // Merge with user progress
      if (userProgress?.subjects[subjectId]) {
        const subjectProgress = userProgress.subjects[subjectId];
        subject.progress = subjectProgress.progress || 0;
        subject.completedVideos = subjectProgress.completedVideos?.length || 0;
        
        // Update concept status based on mastered concepts
        if (subjectProgress.masteredConcepts) {
          subject.concepts = subject.concepts.map(concept => ({
            ...concept,
            status: subjectProgress.masteredConcepts.includes(concept.id) 
              ? 'mastered' 
              : concept.status
          }));
        }
      }

      return subject;
    } catch (error) {
      console.error('Error fetching subject:', error);
      throw error;
    }
  }

  static async searchSubjects(searchText: string, userId: string): Promise<Subject[]> {
    try {
      const subjectsRef = collection(db, SUBJECTS_COLLECTION);
      const searchQuery = query(
        subjectsRef,
        where('searchableText', 'array-contains', searchText.toLowerCase()),
        orderBy('name'),
        limit(10)
      );

      const snapshot = await getDocs(searchQuery);
      const subjects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subject[];

      // Get user progress
      const userProgressRef = doc(db, USER_PROGRESS_COLLECTION, userId);
      const userProgressDoc = await getDoc(userProgressRef);
      const userProgress = userProgressDoc.data() as UserProgress;

      // Merge subject data with user progress
      return subjects.map(subject => ({
        ...subject,
        progress: userProgress?.subjects[subject.id]?.progress || 0,
        completedVideos: userProgress?.subjects[subject.id]?.completedVideos?.length || 0
      }));
    } catch (error) {
      console.error('Error searching subjects:', error);
      throw error;
    }
  }

  static async getUserProgress(userId: string): Promise<UserProgress | null> {
    try {
      const progressRef = doc(db, 'userProgress', userId);
      const progressDoc = await getDoc(progressRef);
      
      if (progressDoc.exists()) {
        return progressDoc.data() as UserProgress;
      }
      return null;
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }

  static async getActiveSubjects(userId: string): Promise<Subject[]> {
    try {
      const progressRef = doc(db, 'userProgress', userId);
      const progressDoc = await getDoc(progressRef);
      
      if (progressDoc.exists()) {
        const progress = progressDoc.data() as UserProgress;
        const subjects = await Promise.all(
          Object.keys(progress.subjects).map(id => 
            this.getSubjectById(id, userId)
          )
        );
        return subjects.filter(Boolean) as Subject[];
      }
      return [];
    } catch (error) {
      console.error('Error getting active subjects:', error);
      throw error;
    }
  }

  static async getAllSubjects(): Promise<Subject[]> {
    try {
      const subjectsRef = collection(db, 'subjects');
      const snapshot = await getDocs(subjectsRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Subject));
    } catch (error) {
      console.error('Error getting all subjects:', error);
      throw error;
    }
  }
} 