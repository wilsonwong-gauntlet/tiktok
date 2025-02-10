import { db } from './firebase-admin';

async function listSavedInsights(userId: string) {
  try {
    const summariesRef = db.collection(`users/${userId}/savedSummaries`);
    const snapshot = await summariesRef.get();
    
    console.log('\nSaved Insights:');
    console.log('==============');
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. Insight ID: ${doc.id}`);
      console.log(`   Title: ${data.videoTitle || 'No title'}`);
      console.log(`   Summary: ${data.summary?.substring(0, 100)}...`);
      console.log(`   Saved at: ${data.savedAt?.toDate().toLocaleString()}`);
      console.log(`   Comment count: ${data.commentCount}`);
    });

    if (snapshot.empty) {
      console.log('No saved insights found');
    }
  } catch (error) {
    console.error('Error listing insights:', error);
  }
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: ts-node list-insights.ts <userId>');
  process.exit(1);
}

listSavedInsights(userId); 