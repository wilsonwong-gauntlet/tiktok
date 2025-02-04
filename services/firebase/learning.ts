import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './index';
import { Note, Quiz, QuizAttempt } from '../../types/video';

// Notes
export async function saveNote(userId: string, videoId: string, content: string, keyTakeaways: string[]) {
  try {
    const notesRef = collection(db, 'users', userId, 'notes');
    const noteData = {
      userId,
      videoId,
      content,
      keyTakeaways,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Check if note already exists
    const existingNoteQuery = query(notesRef, where('videoId', '==', videoId));
    const existingNotes = await getDocs(existingNoteQuery);
    
    if (!existingNotes.empty) {
      // Update existing note
      const noteId = existingNotes.docs[0].id;
      await setDoc(doc(notesRef, noteId), {
        ...noteData,
        createdAt: existingNotes.docs[0].data().createdAt,
      });
      return noteId;
    } else {
      // Create new note
      const newNote = await addDoc(notesRef, noteData);
      return newNote.id;
    }
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
}

export async function getNoteForVideo(userId: string, videoId: string): Promise<Note | null> {
  try {
    const notesRef = collection(db, 'users', userId, 'notes');
    const noteQuery = query(notesRef, where('videoId', '==', videoId));
    const notes = await getDocs(noteQuery);
    
    if (notes.empty) return null;
    
    const noteData = notes.docs[0].data();
    return {
      id: notes.docs[0].id,
      ...noteData,
      createdAt: (noteData.createdAt as Timestamp).toDate(),
      updatedAt: (noteData.updatedAt as Timestamp).toDate(),
    } as Note;
  } catch (error) {
    console.error('Error getting note:', error);
    throw error;
  }
}

// Quiz Attempts
export async function saveQuizAttempt(
  userId: string, 
  quizId: string, 
  answers: number[], 
  score: number
) {
  try {
    const attemptsRef = collection(db, 'users', userId, 'quizAttempts');
    const attemptData = {
      userId,
      quizId,
      answers,
      score,
      completedAt: serverTimestamp(),
    };
    
    const newAttempt = await addDoc(attemptsRef, attemptData);
    return newAttempt.id;
  } catch (error) {
    console.error('Error saving quiz attempt:', error);
    throw error;
  }
}

export async function getQuizAttempts(userId: string, quizId: string): Promise<QuizAttempt[]> {
  try {
    const attemptsRef = collection(db, 'users', userId, 'quizAttempts');
    const attemptsQuery = query(
      attemptsRef, 
      where('quizId', '==', quizId),
      orderBy('completedAt', 'desc')
    );
    
    const attempts = await getDocs(attemptsQuery);
    return attempts.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      completedAt: (doc.data().completedAt as Timestamp).toDate(),
    })) as QuizAttempt[];
  } catch (error) {
    console.error('Error getting quiz attempts:', error);
    throw error;
  }
}

// Get best quiz score
export async function getBestQuizScore(userId: string, quizId: string): Promise<number> {
  try {
    const attempts = await getQuizAttempts(userId, quizId);
    if (attempts.length === 0) return 0;
    
    return Math.max(...attempts.map(attempt => attempt.score));
  } catch (error) {
    console.error('Error getting best quiz score:', error);
    throw error;
  }
} 