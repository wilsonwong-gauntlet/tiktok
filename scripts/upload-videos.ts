import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, basename, join, dirname } from 'path';
import * as readline from 'readline';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { uploadLocalVideo, startTranscription } from './video-service';
import { config } from 'dotenv';
import { db, storage } from './firebase-admin';
import { VideoService } from '../services/firebase/video';
import * as admin from 'firebase-admin';
import { Video } from '../types/video';

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Create temp directory if it doesn't exist
const tempDir = join(__dirname, '..', 'temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function getCommonMetadata() {
  console.log('\nEnter common metadata (will apply to all videos):');
  
  // Get author information
  const authorId = await question('Author ID: ');
  const authorName = await question('Author Name: ');
  
  // Get common tags
  const commonTagsInput = await question('Common tags for all videos (comma-separated): ');
  const commonTags = commonTagsInput.split(',').map(tag => tag.trim()).filter(Boolean);
  
  return { commonTags, authorId, authorName };
}

async function generateThumbnail(videoPath: string): Promise<string> {
  const thumbnailDir = join(tempDir, 'thumbnails');
  const videoName = basename(videoPath).split('.')[0];
  const thumbnailPath = join(thumbnailDir, `${videoName}_thumb.jpg`);

  // Create thumbnails directory if it doesn't exist
  if (!existsSync(thumbnailDir)) {
    mkdirSync(thumbnailDir, { recursive: true });
  }

  return new Promise<string>((resolve, reject) => {
    ffmpeg(videoPath)
      .on('end', () => resolve(thumbnailPath))
      .on('error', (err: Error) => {
        console.error('Error generating thumbnail:', err);
        reject(err);
      })
      .screenshots({
        timestamps: ['50%'],
        filename: basename(thumbnailPath),
        folder: thumbnailDir,
        size: '720x?',
      });
  });
}

async function convertToMp4(inputPath: string): Promise<string> {
  const outputPath = join(tempDir, `${Date.now()}.mp4`);
  
  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-strict experimental',
        '-b:a 192k'
      ])
      .toFormat('mp4')
      .on('end', () => {
        console.log('Video conversion completed');
        resolve(outputPath);
      })
      .on('error', (err: Error) => {
        console.error('Error converting video:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

interface Subject {
  id: string;
  name: string;
}

interface VideoUpload {
  filePath: string;
  thumbnailPath: string;
  title: string;
  description: string;
  subjectId: string;      // Primary subject
  tags: string[];
  authorId: string;
  authorName: string;
  searchableText?: string[];
}

async function listSubjects(): Promise<Subject[]> {
  const snapshot = await db.collection('subjects').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name
  }));
}

async function uploadVideo(videoData: VideoUpload) {
  try {
    // Create searchableText from existing data
    const searchableText = [
      ...videoData.title.toLowerCase().split(' '),
      ...videoData.description.toLowerCase().split(' '),
      ...videoData.tags.map(tag => tag.toLowerCase())
    ];

    // Upload video file to Storage
    const videoFileName = `videos/${Date.now()}-${basename(videoData.filePath)}`;
    const thumbnailFileName = `thumbnails/${Date.now()}-${basename(videoData.thumbnailPath)}`;
    
    // Upload video
    await storage.upload(videoData.filePath, {
      destination: videoFileName,
      metadata: {
        contentType: 'video/mp4'
      }
    });
    
    // Upload thumbnail
    await storage.upload(videoData.thumbnailPath, {
      destination: thumbnailFileName,
      metadata: {
        contentType: 'image/jpeg'
      }
    });

    // Get download URLs
    const [videoFile] = await storage.file(videoFileName).get();
    const [thumbnailFile] = await storage.file(thumbnailFileName).get();
    const videoUrl = await videoFile.getSignedUrl({ action: 'read', expires: '03-01-2500' });
    const thumbnailUrl = await thumbnailFile.getSignedUrl({ action: 'read', expires: '03-01-2500' });

    // Create video document in Firestore
    const videoDoc = {
      title: videoData.title,
      description: videoData.description,
      url: videoUrl[0],
      thumbnailUrl: thumbnailUrl[0],
      duration: 0, // TODO: Get video duration
      createdAt: new Date(),
      subjectId: videoData.subjectId,
      tags: videoData.tags,
      searchableText,
      viewCount: 0,
      authorId: videoData.authorId,
      authorName: videoData.authorName,
      format: 'video/mp4'
    };

    // Add to Firestore
    const docRef = await db.collection('videos').add(videoDoc);
    const videoId = docRef.id;

    // Update subject with video count
    const subjectRef = db.collection('subjects').doc(videoData.subjectId);
    await subjectRef.update({
      videosCount: admin.firestore.FieldValue.increment(1)
    });

    console.log(`Successfully uploaded video ${videoId}`);
    
    // Start transcription process
    console.log('Starting transcription process...');
    await startTranscription(videoId);
    
    return videoId;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
}

async function processVideoUpload(filePath: string, commonMetadata?: { commonTags: string[], authorId: string, authorName: string }) {
  // Generate thumbnail
  console.log(`Generating thumbnail for ${filePath}...`);
  const thumbnailPath = await generateThumbnail(filePath);

  // Convert video to MP4 if needed
  console.log('Converting video to MP4...');
  const mp4Path = await convertToMp4(filePath);

  // Get video metadata from user
  console.log('\nEnter video metadata:');
  const title = await question('Title: ');
  const description = await question('Description: ');
  
  // List available subjects
  const subjects = await listSubjects();
  console.log('\nAvailable subjects:');
  subjects.forEach((subject, index) => {
    console.log(`${index + 1}. ${subject.name}`);
  });
  
  const subjectIndex = parseInt(await question('\nSelect subject number: ')) - 1;
  if (subjectIndex < 0 || subjectIndex >= subjects.length) {
    throw new Error('Invalid subject selection');
  }
  
  const selectedSubject = subjects[subjectIndex];

  // Get additional tags
  const additionalTagsInput = await question('\nAdditional tags (comma-separated): ');
  const additionalTags = additionalTagsInput.split(',').map(tag => tag.trim()).filter(Boolean);
  
  // Combine common tags with additional tags
  const tags = [...(commonMetadata?.commonTags || []), ...additionalTags];

  // Create video upload object
  const videoData: VideoUpload = {
    filePath: mp4Path,
    thumbnailPath,
    title,
    description,
    subjectId: selectedSubject.id,
    tags,
    authorId: commonMetadata?.authorId || 'default-author',
    authorName: commonMetadata?.authorName || 'Default Author'
  };

  try {
    const videoId = await uploadVideo(videoData);
    console.log(`Video uploaded successfully with ID: ${videoId}`);
    
    // Clean up temporary files
    unlinkSync(mp4Path);
    unlinkSync(thumbnailPath);
  } catch (error) {
    console.error('Error processing video upload:', error);
    throw error;
  }
}

async function main() {
  try {
    // Get common metadata
    const commonMetadata = await getCommonMetadata();
    
    // Get video files from command line arguments
    const videoFiles = process.argv.slice(2);
    if (videoFiles.length === 0) {
      console.error('Please provide video file paths as arguments');
      process.exit(1);
    }

    // Process each video
    for (const filePath of videoFiles) {
      if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        continue;
      }

      console.log(`\nProcessing ${filePath}...`);
      await processVideoUpload(filePath, commonMetadata);
    }

    console.log('\nAll videos processed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main(); 