import { TranscriptionService } from './transcription-service';
import { db } from './firebase-admin';

async function main() {
  try {
    // Get video ID from command line arguments
    const videoId = process.argv[2];
    if (!videoId) {
      console.error('Please provide a video ID');
      process.exit(1);
    }

    // Get video document
    const videoDoc = await db.collection('videos').doc(videoId).get();
    if (!videoDoc.exists) {
      console.error('Video not found');
      process.exit(1);
    }

    const videoData = videoDoc.data();
    if (!videoData) {
      console.error('Video data is empty');
      process.exit(1);
    }

    // Update transcription status to pending
    await videoDoc.ref.update({
      transcriptionStatus: 'pending',
      transcriptionError: null
    });

    // Get video URL
    const videoUrl = videoData.url;
    if (!videoUrl) {
      throw new Error('Video URL not found');
    }

    // Process the video
    await TranscriptionService.processVideo(videoId, videoUrl);
    
    console.log('Transcription completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 