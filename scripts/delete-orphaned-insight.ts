import { db } from './firebase-admin';

async function deleteOrphanedInsight(userId: string, videoId: string) {
  try {
    // First verify the insight exists
    const insightRef = db.doc(`users/${userId}/savedSummaries/${videoId}`);
    const insight = await insightRef.get();
    
    if (!insight.exists) {
      console.log('Insight not found');
      return;
    }

    // Delete the insight
    await insightRef.delete();
    console.log(`Successfully deleted insight for video ${videoId}`);
  } catch (error) {
    console.error('Error deleting insight:', error);
  }
}

// Replace these with your actual values
const userId = process.argv[2];
const videoId = process.argv[3];

if (!userId || !videoId) {
  console.log('Usage: ts-node delete-orphaned-insight.ts <userId> <videoId>');
  process.exit(1);
}

deleteOrphanedInsight(userId, videoId); 