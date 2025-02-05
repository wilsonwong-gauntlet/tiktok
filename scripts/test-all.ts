import { config } from 'dotenv';
import { join } from 'path';
import { uploadLocalVideo } from './video-service';
import { db } from './firebase-admin';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { unlinkSync, existsSync } from 'fs';

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function cleanupTempFiles(files: string[]) {
  for (const file of files) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
        console.log(`Cleaned up: ${file}`);
      } catch (error) {
        console.warn(`Failed to clean up ${file}:`, error);
      }
    }
  }
}

async function convertWebmToMp4(inputPath: string): Promise<string> {
  const outputPath = join(__dirname, '..', 'temp', `${Date.now()}.mp4`);
  
  console.log('Converting WebM to MP4...');
  console.log('Input:', inputPath);
  console.log('Output:', outputPath);
  
  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264', // Use H.264 codec for video
        '-c:a aac',     // Use AAC codec for audio
        '-strict experimental',
        '-b:a 192k'     // Audio bitrate
      ])
      .toFormat('mp4')
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent?.toFixed(2)}% done`);
      })
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

async function generateThumbnail(videoPath: string): Promise<string> {
  const outputDir = join(__dirname, '..', 'temp');
  const thumbnailName = `${Date.now()}_thumb.jpg`;
  const thumbnailPath = join(outputDir, thumbnailName);

  console.log('Generating thumbnail...');
  console.log('Video path:', videoPath);
  console.log('Thumbnail path:', thumbnailPath);

  return new Promise<string>((resolve, reject) => {
    ffmpeg(videoPath)
      .on('end', () => {
        console.log('Thumbnail generation completed');
        resolve(thumbnailPath);
      })
      .on('error', (err: Error) => {
        console.error('Error generating thumbnail:', err);
        reject(err);
      })
      .screenshots({
        count: 1,
        timestamps: ['50%'], // Take screenshot from middle of video
        filename: thumbnailName,
        folder: outputDir,
        size: '720x?', // 720p width, maintain aspect ratio
      });
  });
}

async function waitForTranscription(videoId: string, maxAttempts = 10): Promise<void> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const videoDoc = await db.collection('videos').doc(videoId).get();
    const data = videoDoc.data();
    
    if (!data) {
      throw new Error('Video document not found');
    }

    if (data.transcriptionStatus === 'completed') {
      console.log('\nTranscription completed!');
      console.log('Transcription text:', data.transcription);
      console.log('Updated at:', data.transcriptionUpdatedAt?.toDate());
      return;
    }

    if (data.transcriptionStatus === 'error') {
      throw new Error(`Transcription failed: ${data.transcriptionError}`);
    }

    console.log(`Transcription status: ${data.transcriptionStatus}. Waiting 5 seconds... (Attempt ${attempts + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Transcription timed out');
}

async function testVideoProcessing(videoPath: string, title: string, description: string) {
  console.log('\n=== Starting Video Processing Test ===\n');
  const tempFiles: string[] = [];
  
  try {
    // Step 1: Convert WebM to MP4 (if needed)
    let mp4Path = videoPath;
    if (videoPath.toLowerCase().endsWith('.webm')) {
      console.log('\n--- Step 1: Converting WebM to MP4 ---\n');
      mp4Path = await convertWebmToMp4(videoPath);
      tempFiles.push(mp4Path);
    }
    
    // Step 2: Generate thumbnail
    console.log('\n--- Step 2: Generating Thumbnail ---\n');
    const thumbnailPath = await generateThumbnail(mp4Path);
    tempFiles.push(thumbnailPath);
    
    // Step 3: Upload video
    console.log('\n--- Step 3: Uploading Video ---\n');
    const videoData = {
      filePath: mp4Path,
      thumbnailPath: thumbnailPath,
      title: title,
      description: description,
      category: 'Test',
      tags: ['test', 'automation'],
      authorId: 'test-user',
      authorName: 'Test User'
    };

    const videoId = await uploadLocalVideo(videoData);
    console.log('Video uploaded successfully with ID:', videoId);

    // Step 4: Wait for transcription
    console.log('\n--- Step 4: Waiting for Transcription ---\n');
    await waitForTranscription(videoId);
    
    console.log('\n=== Test Completed Successfully ===\n');
    return videoId;
  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    throw error;
  } finally {
    // Clean up temporary files
    console.log('\n--- Cleaning Up Temporary Files ---\n');
    await cleanupTempFiles(tempFiles);
  }
}

async function main() {
  try {
    // Test 1: Process the Stoicism video
    const stoicismPath = join(__dirname, '..', 'What is Stoicism？ @ludwig [eP2yiWBOx_0].webm');
    await testVideoProcessing(
      stoicismPath,
      'What is Stoicism?',
      'An exploration of Stoic philosophy and its principles by Ludwig'
    );

  } catch (error) {
    console.error('\nTest suite failed:', error);
    process.exit(1);
  }
}

// Run the test suite
console.log('\n=== Starting Test Suite ===\n');
main(); 