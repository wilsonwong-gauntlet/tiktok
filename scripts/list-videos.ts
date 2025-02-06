import { db } from './firebase-admin';

async function main() {
  try {
    console.log('\nFetching videos from Firestore...\n');
    
    const videosRef = db.collection('videos');
    const snapshot = await videosRef.get();
    
    if (snapshot.empty) {
      console.log('No videos found in the database.');
      return;
    }

    console.log('Available Videos:');
    console.log('----------------');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Title: ${data.title}`);
      console.log(`Category: ${data.category}`);
      console.log(`URL: ${data.url}`);
      console.log(`Transcription Status: ${data.transcriptionStatus || 'not started'}`);
      console.log('----------------');
    });

    console.log('\nTo transcribe a video, run:');
    console.log('npx ts-node scripts/transcribe-video.ts VIDEO_ID');
    console.log('\nReplace VIDEO_ID with the ID of the video you want to transcribe.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 