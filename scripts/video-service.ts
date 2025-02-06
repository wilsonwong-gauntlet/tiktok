import { db, storage } from './firebase-admin';
import { readFileSync } from 'fs';
import * as admin from 'firebase-admin';
import { spawn } from 'child_process';
import { join } from 'path';
import { basename } from 'path';
import { initializeApp } from 'firebase/app';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

interface VideoUpload {
  filePath: string;
  thumbnailPath: string;
  title: string;
  description: string;
  subjectId: string;      // Primary subject
  conceptIds: string[];   // Primary concepts
  relatedSubjects?: string[];
  tags: string[];
  authorId: string;
  authorName: string;
}

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export async function startTranscription(videoId: string) {
  return new Promise((resolve, reject) => {
    const transcribeScript = join(__dirname, 'transcribe-video.ts');
    console.log('Starting transcription process with script:', transcribeScript);
    
    const childProcess = spawn('npx', ['ts-node', transcribeScript, videoId], {
      stdio: 'pipe',  // Capture all output
      env: {
        ...process.env,
        PATH: process.env.PATH,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      }
    });

    let output = '';
    let errorOutput = '';

    // Capture output
    childProcess.stdout?.on('data', (data) => {
      const message = data.toString();
      output += message;
      process.stdout.write(message);  // Forward to parent process
    });

    childProcess.stderr?.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      process.stderr.write(message);  // Forward to parent process
    });

    childProcess.on('close', (code: number) => {
      if (code === 0) {
        console.log('Transcription process completed successfully');
        resolve(true);
      } else {
        const error = new Error(`Transcription process failed with code ${code}.\nOutput: ${output}\nError: ${errorOutput}`);
        console.error(error.message);
        reject(error);
      }
    });

    childProcess.on('error', (err: Error) => {
      console.error('Failed to start transcription process:', err);
      reject(err);
    });
  });
}

export async function uploadLocalVideo(videoData: VideoUpload): Promise<string> {
  try {
    // Create file names for storage
    const videoFileName = `videos/${Date.now()}-${basename(videoData.filePath)}`;
    const thumbnailFileName = `thumbnails/${Date.now()}-${basename(videoData.thumbnailPath)}`;

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
      subjectId: videoData.subjectId,
      conceptIds: videoData.conceptIds,
      relatedSubjects: videoData.relatedSubjects || [],
      tags: videoData.tags,
      searchableText: [
        ...videoData.title.toLowerCase().split(' '),
        ...videoData.description.toLowerCase().split(' '),
        ...videoData.tags.map(tag => tag.toLowerCase())
      ],
      viewCount: 0,
      authorId: videoData.authorId,
      authorName: videoData.authorName,
      format: 'video/mp4',
      transcriptionStatus: 'pending',  // Add initial status
      transcriptionError: null
    };

    const docRef = await db.collection('videos').add(videoDoc);
    const videoId = docRef.id;

    // Start transcription process and wait for it to complete
    console.log('\nStarting transcription process...');
    try {
      await startTranscription(videoId);  // This will now wait for completion
      console.log('Transcription completed successfully');
      
      // Update the status one final time to ensure it's marked as completed
      await docRef.update({
        transcriptionStatus: 'completed'
      });
    } catch (error: any) {
      console.error('Failed to complete transcription:', error);
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