import { db, storage } from './firebase-admin';
import { readFileSync } from 'fs';
import * as admin from 'firebase-admin';
import { TranscriptionService } from '../services/openai/transcription';

interface LocalVideoUpload {
  filePath: string;
  thumbnailPath: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  authorId: string;
  authorName: string;
}

export async function uploadLocalVideo(videoData: LocalVideoUpload): Promise<string> {
  try {
    // Create file names for storage
    const videoFileName = `videos/${Date.now()}-${videoData.filePath.split('/').pop()}`;
    const thumbnailFileName = `thumbnails/${Date.now()}-${videoData.thumbnailPath.split('/').pop()}`;

    // Read and upload the video file
    const videoBuffer = readFileSync(videoData.filePath);
    const videoFile = storage.file(videoFileName);
    await videoFile.save(videoBuffer, {
      metadata: {
        contentType: 'video/mp4'
      }
    });

    // Read and upload the thumbnail
    const thumbnailBuffer = readFileSync(videoData.thumbnailPath);
    const thumbnailFile = storage.file(thumbnailFileName);
    await thumbnailFile.save(thumbnailBuffer, {
      metadata: {
        contentType: 'image/jpeg'
      }
    });

    // Get the download URLs
    const [videoUrl] = await videoFile.getSignedUrl({
      action: 'read',
      expires: '03-01-2500' // Far future expiration
    });

    const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
      action: 'read',
      expires: '03-01-2500' // Far future expiration
    });

    // Create a video document in Firestore
    const videoDoc = {
      title: videoData.title,
      description: videoData.description,
      url: videoUrl,
      thumbnailUrl: thumbnailUrl,
      duration: 0, // TODO: Get video duration
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      category: videoData.category,
      tags: videoData.tags,
      searchableText: [
        ...videoData.title.toLowerCase().split(' '),
        ...videoData.description.toLowerCase().split(' '),
        ...videoData.tags.map(tag => tag.toLowerCase())
      ],
      viewCount: 0,
      authorId: videoData.authorId,
      authorName: videoData.authorName,
      transcriptionStatus: 'pending'
    };

    const docRef = await db.collection('videos').add(videoDoc);
    
    // Start transcription process
    console.log('Starting transcription process...');
    TranscriptionService.processVideo(docRef.id, videoFileName)
      .then(transcription => {
        console.log('Transcription completed successfully');
      })
      .catch(error => {
        console.error('Error during transcription:', error);
      });

    return docRef.id;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
} 