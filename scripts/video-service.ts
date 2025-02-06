import { db, storage } from './firebase-admin';
import { readFileSync } from 'fs';
import * as admin from 'firebase-admin';
import { spawn } from 'child_process';
import { join } from 'path';

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

async function startTranscription(videoId: string) {
  return new Promise((resolve, reject) => {
    const transcribeScript = join(__dirname, 'transcribe-video.ts');
    const process = spawn('npx', ['ts-node', transcribeScript, videoId], {
      stdio: 'inherit'
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Transcription process exited with code ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
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
      transcriptionStatus: 'pending',
      transcriptionError: null
    };

    const docRef = await db.collection('videos').add(videoDoc);
    const videoId = docRef.id;

    // Start transcription process
    console.log('\nStarting transcription process...');
    try {
      await startTranscription(videoId);
      console.log('Transcription process started successfully');
    } catch (error: any) {
      console.error('Failed to start transcription:', error);
      // Update the video document with the error
      await docRef.update({
        transcriptionStatus: 'error',
        transcriptionError: error.message || 'Unknown error occurred'
      });
    }

    return videoId;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
} 