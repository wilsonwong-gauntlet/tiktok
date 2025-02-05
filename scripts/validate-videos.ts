import { db, storage } from './firebase-admin';

const VIDEOS_COLLECTION = 'videos';

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function validateAndCleanupVideos() {
  try {
    const videosRef = db.collection(VIDEOS_COLLECTION);
    const snapshot = await videosRef.get();
    
    console.log('\nStarting video validation...');
    console.log(`Found ${snapshot.size} video documents`);

    const cleanupPromises = snapshot.docs.map(async (doc) => {
      const videoData = doc.data();
      const videoUrl = videoData.url;
      console.log(`\nChecking video document ${doc.id}:`);
      console.log(`Title: ${videoData.title}`);
      console.log(`URL: ${videoUrl}`);

      try {
        // Check if it's a Firebase Storage URL
        if (videoUrl.includes('firebasestorage.googleapis.com')) {
          try {
            const videoPath = decodeURIComponent(videoUrl.split('/o/')[1].split('?')[0]);
            console.log(`Storage path: ${videoPath}`);
            const file = storage.file(videoPath);
            const exists = await file.exists();
            
            if (exists[0]) {
              console.log('✓ Video file exists in Firebase Storage');
              return false; // Document is valid
            } else {
              console.log('✗ Video file not found in Firebase Storage, deleting document...');
              await doc.ref.delete();
              return true; // Document was deleted
            }
          } catch (storageError) {
            console.error('Storage error:', storageError);
            return false;
          }
        } else {
          // For external URLs, try to fetch them
          const exists = await checkUrlExists(videoUrl);
          if (exists) {
            console.log('✓ External video file is accessible');
            return false; // Document is valid
          } else {
            console.log('✗ External video file is not accessible, deleting document...');
            await doc.ref.delete();
            return true; // Document was deleted
          }
        }
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        return false;
      }
    });

    const results = await Promise.all(cleanupPromises);
    const deletedCount = results.filter(Boolean).length;
    console.log(`\nCleanup complete. Removed ${deletedCount} invalid video documents`);
  } catch (error) {
    console.error('Error validating videos:', error);
    throw error;
  }
}

async function main() {
  try {
    await validateAndCleanupVideos();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 