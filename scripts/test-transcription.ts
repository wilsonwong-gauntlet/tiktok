import { config } from 'dotenv';
import { join } from 'path';
import { uploadLocalVideo } from './video-service';
import { db } from './firebase-admin';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Load environment variables
config();

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function convertWebmToMp4(inputPath: string): Promise<string> {
  const outputPath = join(__dirname, '..', 'temp', `${Date.now()}.mp4`);
  
  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264', // Use H.264 codec for video
        '-c:a aac',     // Use AAC codec for audio
        '-strict experimental',
        '-b:a 192k'     // Audio bitrate
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

async function generateThumbnail(videoPath: string): Promise<string> {
  const outputDir = join(__dirname, '..', 'temp');
  const thumbnailName = `${Date.now()}_thumb.jpg`;
  const thumbnailPath = join(outputDir, thumbnailName);

  return new Promise<string>((resolve, reject) => {
    ffmpeg(videoPath)
      .on('end', () => resolve(thumbnailPath))
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
      console.log('Transcription completed:', data.transcription);
      return;
    }

    if (data.transcriptionStatus === 'error') {
      throw new Error(`Transcription failed: ${data.transcriptionError}`);
    }

    console.log(`Transcription status: ${data.transcriptionStatus}. Waiting 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Transcription timed out');
}

async function main() {
  try {
    console.log('Starting test...');
    
    // Convert WebM to MP4
    const webmPath = join(__dirname, '..', 'What is Stoicism？ @ludwig [eP2yiWBOx_0].webm');
    console.log('Converting WebM to MP4...');
    const mp4Path = await convertWebmToMp4(webmPath);
    
    // Generate thumbnail
    console.log('Generating thumbnail...');
    const thumbnailPath = await generateThumbnail(mp4Path);
    
    // Upload video
    console.log('Uploading video...');
    const videoData = {
      filePath: mp4Path,
      thumbnailPath: thumbnailPath,
      title: 'What is Stoicism?',
      description: 'An exploration of Stoic philosophy and its principles',
      category: 'Philosophy',
      tags: ['philosophy', 'stoicism', 'wisdom', 'education'],
      authorId: 'test-user',
      authorName: 'Ludwig'
    };

    const videoId = await uploadLocalVideo(videoData);
    console.log('Video uploaded with ID:', videoId);

    // Wait for transcription
    console.log('Waiting for transcription...');
    await waitForTranscription(videoId);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 