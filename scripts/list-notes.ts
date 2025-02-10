import { db } from './firebase-admin';

async function listSavedNotes(userId: string) {
  try {
    const notesRef = db.collection(`users/${userId}/notes`);
    const snapshot = await notesRef.get();
    
    console.log('\nSaved Notes:');
    console.log('==============');
    
    // Get all video IDs from notes
    const videoIds = new Set(snapshot.docs.map(doc => doc.data().videoId));
    
    // Check which videos exist
    const videosRef = db.collection('videos');
    const videoSnapshots = await Promise.all(
      Array.from(videoIds).map(id => videosRef.doc(id).get())
    );
    const existingVideoIds = new Set(
      videoSnapshots.filter(doc => doc.exists).map(doc => doc.id)
    );
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const isOrphaned = !existingVideoIds.has(data.videoId);
      
      console.log(`\n${index + 1}. Note ID: ${doc.id}`);
      console.log(`   Video ID: ${data.videoId}${isOrphaned ? ' (ORPHANED)' : ''}`);
      console.log(`   Content: ${data.content?.substring(0, 100)}...`);
      console.log(`   Created at: ${data.createdAt?.toDate().toLocaleString()}`);
      if (data.updatedAt) {
        console.log(`   Updated at: ${data.updatedAt.toDate().toLocaleString()}`);
      }
      if (isOrphaned) {
        console.log('   ⚠️  This note is orphaned (video no longer exists)');
      }
    });

    if (snapshot.empty) {
      console.log('No saved notes found');
    }
  } catch (error) {
    console.error('Error listing notes:', error);
  }
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: ts-node list-notes.ts <userId>');
  process.exit(1);
}

listSavedNotes(userId); 