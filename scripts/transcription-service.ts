import { config } from 'dotenv';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { db, storage } from './firebase-admin';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import fetch from 'node-fetch';

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Ensure temp directory exists
const tempDir = join(__dirname, '..', 'temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class TranscriptionService {
  static async downloadVideo(url: string): Promise<Buffer> {
    // Check if it's a Firebase Storage URL
    if (url.includes('firebasestorage.googleapis.com')) {
      const storagePath = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
      console.log('Firebase Storage path:', storagePath);
      const file = storage.file(storagePath);
      const [buffer] = await file.download();
      return buffer;
    } else {
      // Direct download for other URLs
      console.log('Downloading from direct URL:', url);
      const response = await fetch(url);
      return Buffer.from(await response.arrayBuffer());
    }
  }

  static async extractAudioFromVideo(videoUrl: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        // Download video
        console.log('Downloading video...');
        const videoBuffer = await this.downloadVideo(videoUrl);
        
        // Create temporary files in the temp directory
        const tempVideoPath = join(tempDir, `input-${Date.now()}.mp4`);
        const tempAudioPath = join(tempDir, `output-${Date.now()}.mp3`);
        
        require('fs').writeFileSync(tempVideoPath, videoBuffer);
        
        // Extract audio using FFmpeg
        console.log('Extracting audio...');
        ffmpeg(tempVideoPath)
          .toFormat('mp3')
          .on('end', () => {
            // Read the audio file
            const audioBuffer = require('fs').readFileSync(tempAudioPath);
            
            // Clean up temporary files
            require('fs').unlinkSync(tempVideoPath);
            require('fs').unlinkSync(tempAudioPath);
            
            resolve(audioBuffer);
          })
          .on('error', (err: Error) => {
            // Clean up on error
            try {
              require('fs').unlinkSync(tempVideoPath);
              require('fs').unlinkSync(tempAudioPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            reject(err);
          })
          .save(tempAudioPath);
      } catch (error) {
        reject(error);
      }
    });
  }

  static async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      // Create a temporary file for the audio
      const tempPath = join(tempDir, `audio-${Date.now()}.mp3`);
      require('fs').writeFileSync(tempPath, audioBuffer);
      const transcription = await openai.audio.transcriptions.create({
        file: require('fs').createReadStream(tempPath),
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });
      // Clean up
      require('fs').unlinkSync(tempPath);
      return transcription;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  static async processVideo(videoId: string, videoUrl: string) {
    try {
      console.log(`Starting transcription process for video ${videoId}`);
      
      // Extract audio from video
      console.log('Extracting audio...');
      const audioBuffer = await this.extractAudioFromVideo(videoUrl);
      
      // Transcribe audio
      console.log('Transcribing audio...');
      const transcription = await this.transcribeAudio(audioBuffer);
      
      // Update video document with transcription
      console.log('Updating video document...');
      await db.collection('videos').doc(videoId).update({
        transcription,
        transcriptionStatus: 'completed',
        transcriptionUpdatedAt: new Date()
      });
      console.log('Transcription process completed successfully');
      return transcription;
    } catch (error: any) {
      console.error('Error processing video:', error);
      
      // Update video document with error status
      await db.collection('videos').doc(videoId).update({
        transcriptionStatus: 'error',
        transcriptionError: error?.message || 'Unknown error'
      });
      
      throw error;
    }
  }
} 