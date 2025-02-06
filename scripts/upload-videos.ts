import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, basename, join, dirname } from 'path';
import * as readline from 'readline';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { uploadLocalVideo } from './video-service';
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

interface Subject {
  id: string;
  name: string;
}

interface Concept {
  id: string;
  name: string;
}

interface LocalVideoUpload extends VideoUpload {
  searchableText: string[];
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
  searchableText?: string[]; // Make searchableText optional
}

async function listSubjects(): Promise<Subject[]> {
  const snapshot = await db.collection('subjects').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name
  }));
}

async function listConcepts(subjectId: string): Promise<Concept[]> {
  const snapshot = await db.collection('subjects').doc(subjectId).collection('concepts').get();
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
      conceptIds: videoData.conceptIds,
      relatedSubjects: videoData.relatedSubjects || [],
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

    // Get the subject document and its concepts
    const subjectRef = db.collection('subjects').doc(videoData.subjectId);
    const subjectDoc = await subjectRef.get();
    const subjectData = subjectDoc.data();

    // Get all concepts for this subject
    const conceptsSnapshot = await subjectRef.collection('concepts').get();
    const concepts = conceptsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Update subject with concepts and video counts
    await subjectRef.update({
      videosCount: admin.firestore.FieldValue.increment(1),
      primaryVideos: admin.firestore.FieldValue.arrayUnion(videoId),
      concepts: concepts // Ensure concepts array is present in subject document
    });

    // Update concepts' video lists
    const batch = db.batch();
    for (const conceptId of videoData.conceptIds) {
      const conceptRef = subjectRef.collection('concepts').doc(conceptId);
      const conceptDoc = await conceptRef.get();
      
      if (conceptDoc.exists) {
        batch.update(conceptRef, {
          primaryVideos: admin.firestore.FieldValue.arrayUnion(videoId)
        });
      } else {
        console.warn(`Concept ${conceptId} not found in subject ${videoData.subjectId}`);
      }
    }
    await batch.commit();

    console.log(`Successfully uploaded video ${videoId} and updated relationships`);
    return videoId;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
}

async function processVideoUpload(filePath: string, commonMetadata?: { category: string; commonTags: string[] }) {
  // Generate thumbnail
  console.log(`Generating thumbnail for ${filePath}...`);
  const thumbnailPath = await generateThumbnail(filePath);

  // Convert video to MP4 if needed
  console.log('Converting video to MP4...');
  const mp4Path = await convertToMp4(filePath);

  // Get video metadata from user input
  const title = await question('Enter video title: ');
  const description = await question('Enter video description: ');
  
  // Get subject and concepts
  console.log('\nAvailable subjects:');
  const subjects = await listSubjects();
  subjects.forEach((s, i) => console.log(`${i + 1}. ${s.name}`));
  
  const subjectIndex = parseInt(await question('Select subject (enter number): ')) - 1;
  if (subjectIndex < 0 || subjectIndex >= subjects.length) {
    throw new Error('Invalid subject selection');
  }
  const selectedSubject = subjects[subjectIndex];
  
  console.log('\nAvailable concepts for selected subject:');
  const concepts = await listConcepts(selectedSubject.id);
  concepts.forEach((c, i) => console.log(`${i + 1}. ${c.name}`));
  
  const conceptInput = await question('Select concepts (comma-separated numbers): ');
  const conceptIndices = conceptInput.split(',')
    .map(i => parseInt(i.trim()) - 1)
    .filter(i => i >= 0 && i < concepts.length);
  
  if (conceptIndices.length === 0) {
    throw new Error('No valid concepts selected');
  }
  
  const conceptIds = conceptIndices.map(i => concepts[i].id);

  // Get tags
  const specificTags = (await question('\nEnter specific tags for this video (comma-separated): '))
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

  const tags = [...new Set([
    ...(commonMetadata?.commonTags || []),
    ...specificTags
  ])];

  // Create video upload data
  const videoData: VideoUpload = {
    filePath: mp4Path,
    thumbnailPath,
    title,
    description,
    subjectId: selectedSubject.id,
    conceptIds,
    tags,
    authorId: 'sample-author',
    authorName: 'AI Learning Channel'
  };

  return await uploadVideo(videoData);
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
      const result = await processVideoUpload(filePath, commonMetadata);
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