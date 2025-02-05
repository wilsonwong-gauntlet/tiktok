import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  addDoc,
  doc,
  updateDoc,
  increment,
  where,
  serverTimestamp,
  Timestamp,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './index';
import { Comment } from '../../types/video';

const COMMENTS_COLLECTION = 'comments';
const COMMENTS_PER_PAGE = 20;

export async function addComment(
  videoId: string,
  userId: string,
  userName: string,
  content: string
): Promise<string> {
  try {
    const commentsRef = collection(db, COMMENTS_COLLECTION);
    const commentData = {
      videoId,
      userId,
      userName,
      content,
      createdAt: serverTimestamp(),
      likes: 0,
    };

    const docRef = await addDoc(commentsRef, commentData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

export async function getComments(
  videoId: string,
  lastVisible?: QueryDocumentSnapshot<any>
): Promise<{ comments: Comment[]; lastVisible: QueryDocumentSnapshot<any> | null }> {
  try {
    const commentsRef = collection(db, COMMENTS_COLLECTION);
    let commentsQuery = query(
      commentsRef,
      where('videoId', '==', videoId),
      orderBy('createdAt', 'desc'),
      limit(COMMENTS_PER_PAGE)
    );

    if (lastVisible) {
      commentsQuery = query(
        commentsRef,
        where('videoId', '==', videoId),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limit(COMMENTS_PER_PAGE)
      );
    }

    const snapshot = await getDocs(commentsQuery);
    const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp).toDate()
    })) as Comment[];

    return {
      comments,
      lastVisible: lastVisibleDoc
    };
  } catch (error) {
    console.error('Error getting comments:', error);
    throw error;
  }
}

export async function likeComment(commentId: string): Promise<void> {
  try {
    const commentRef = doc(db, COMMENTS_COLLECTION, commentId);
    await updateDoc(commentRef, {
      likes: increment(1)
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    throw error;
  }
}

export async function addReply(
  parentCommentId: string,
  userId: string,
  userName: string,
  content: string
): Promise<string> {
  try {
    const repliesRef = collection(db, COMMENTS_COLLECTION, parentCommentId, 'replies');
    const replyData = {
      userId,
      userName,
      content,
      createdAt: serverTimestamp(),
      likes: 0,
    };

    const docRef = await addDoc(repliesRef, replyData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding reply:', error);
    throw error;
  }
}

export async function getReplies(commentId: string): Promise<Comment[]> {
  try {
    const repliesRef = collection(db, COMMENTS_COLLECTION, commentId, 'replies');
    const repliesQuery = query(repliesRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(repliesQuery);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp).toDate()
    })) as Comment[];
  } catch (error) {
    console.error('Error getting replies:', error);
    throw error;
  }
} 