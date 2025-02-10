import { db } from './firebase-admin';

async function deleteOrphanedNote(userId: string, videoId: string, noteId: string) {
  try {
    // First verify the note exists
    const noteRef = db.doc(`users/${userId}/notes/${noteId}`);
    const note = await noteRef.get();
    
    if (!note.exists) {
      console.log('Note not found');
      return;
    }

    // Verify this is actually an orphaned note by checking if video exists
    const videoRef = db.doc(`videos/${videoId}`);
    const video = await videoRef.get();

    if (video.exists) {
      console.log('Warning: Video still exists. This note is not orphaned.');
      return;
    }

    // Delete the note
    await noteRef.delete();
    console.log(`Successfully deleted orphaned note ${noteId} for video ${videoId}`);
  } catch (error) {
    console.error('Error deleting note:', error);
  }
}

// Get command line arguments
const userId = process.argv[2];
const videoId = process.argv[3];
const noteId = process.argv[4];

if (!userId || !videoId || !noteId) {
  console.log('Usage: ts-node delete-orphaned-note.ts <userId> <videoId> <noteId>');
  process.exit(1);
}

deleteOrphanedNote(userId, videoId, noteId); 