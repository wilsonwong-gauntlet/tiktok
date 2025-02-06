import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, basename, join, dirname } from 'path';
import * as readline from 'readline';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { uploadLocalVideo } from './video-service';
import { config } from 'dotenv';
import { db } from './firebase-admin';
import { VideoService } from '../services/firebase/video';
import * as admin from 'firebase-admin';

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

// Common categories and tags for quick selection
const COMMON_CATEGORIES = [
  'Technology',
  'Programming',
  'Tutorial',
  'Education',
  'Entertainment',
  'Philosophy',
  'Physics',
  'Mathematics'
];

async function selectFromOptions(options: string[], customAllowed = true): Promise<string> {
  console.log('\nAvailable options:');
  options.forEach((opt, i) => console.log(`${i + 1}. ${opt}`));
  if (customAllowed) {
    console.log('Or enter your own');
  }
  const answer = await question('Select option (enter number or custom value): ');
  const index = parseInt(answer) - 1;
  if (index >= 0 && index < options.length) {
    return options[index];
  }
  return customAllowed ? answer : options[0];
}

async function getCommonMetadata() {
  console.log('\nEnter common metadata (will apply to all videos):');
  console.log('\nSelect category:');
  const category = await selectFromOptions(COMMON_CATEGORIES);
  
  const commonTagsInput = await question('\nCommon tags for all videos (comma-separated): ');
  const commonTags = commonTagsInput.split(',').map(tag => tag.trim()).filter(Boolean);
  
  return { category, commonTags };
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

async function uploadVideo(videoData: VideoUpload) {
  try {
    // Upload video and get video ID
    const videoId = await VideoService.uploadLocalVideo({
      ...videoData,
      searchableText: [
        ...videoData.title.toLowerCase().split(' '),
        ...videoData.description.toLowerCase().split(' '),
        ...videoData.tags.map(tag => tag.toLowerCase())
      ]
    });

    // Update subject's video counts
    const subjectRef = db.collection('subjects').doc(videoData.subjectId);
    await subjectRef.update({
      videosCount: admin.firestore.FieldValue.increment(1),
      primaryVideos: admin.firestore.FieldValue.arrayUnion(videoId)
    });

    // Update concepts' video lists
    const batch = db.batch();
    for (const conceptId of videoData.conceptIds) {
      const conceptRef = db.collection('concepts').doc(conceptId);
      batch.update(conceptRef, {
        primaryVideos: admin.firestore.FieldValue.arrayUnion(videoId)
      });
    }
    await batch.commit();

    console.log(`Successfully uploaded video ${videoId} and updated relationships`);
    return videoId;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
}

async function main() {
  try {
    const filePaths = process.argv.slice(2);
    if (filePaths.length === 0) {
      console.error('Please provide at least one video file path');
      process.exit(1);
    }

    console.log(`Found ${filePaths.length} videos to upload`);
    
    const useCommonMetadata = (await question('\nDo you want to enter common metadata for all videos? (y/n): ')).toLowerCase() === 'y';
    const commonMetadata = useCommonMetadata ? await getCommonMetadata() : undefined;

    const results = [];
    for (const filePath of filePaths) {
      const result = await uploadVideo(filePath, commonMetadata);
      results.push({ filePath, success: !!result, videoId: result });
    }

    console.log('\nUpload Summary:');
    console.log('----------------');
    results.forEach(({ filePath, success, videoId }) => {
      console.log(`${basename(filePath)}: ${success ? `Success (ID: ${videoId})` : 'Failed'}`);
    });
    
    rl.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 