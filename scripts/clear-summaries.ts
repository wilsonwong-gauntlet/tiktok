import { db } from './firebase-admin';

const VIDEOS_COLLECTION = 'videos';

async function clearSummaries() {
  try {
    const videosRef = db.collection(VIDEOS_COLLECTION);
    const snapshot = await videosRef.get();
    
    const clearPromises = snapshot.docs.map(async (doc) => {
      await doc.ref.update({
        summary: null,
        aiSummary: null // Clear the old field as well
      });
      console.log(`Cleared summary for video: ${doc.id}`);
    });

    await Promise.all(clearPromises);
    console.log('Successfully cleared all summaries');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing summaries:', error);
    process.exit(1);
  }
}

clearSummaries(); 