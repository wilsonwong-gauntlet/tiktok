import { config } from 'dotenv';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { db, storage } from '../../scripts/firebase-admin';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '..', '.env.local') });

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Ensure temp directory exists
const tempDir = join(__dirname, '..', '..', 'temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class TranscriptionService {
  static async extractAudioFromVideo(storagePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Download video from Firebase Storage
      const file = storage.file(storagePath);
      file.download().then(([buffer]) => {
        // Create temporary files in the temp directory
        const tempVideoPath = join(tempDir, `input-${Date.now()}.mp4`);
        const tempAudioPath = join(tempDir, `output-${Date.now()}.mp3`);
        
        require('fs').writeFileSync(tempVideoPath, buffer);

        // Extract audio using FFmpeg
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
      }).catch(reject);
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