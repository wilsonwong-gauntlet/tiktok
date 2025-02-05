import { join, dirname, basename } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function generateThumbnail(videoPath: string): Promise<string> {
  const dir = dirname(videoPath);
  const filename = basename(videoPath, '.mp4');
  const thumbnailPath = join(dir, `${filename}_thumb.jpg`);

  return new Promise<string>((resolve, reject) => {
    ffmpeg(videoPath)
      .on('end', () => resolve(thumbnailPath))
      .on('error', (err: Error) => {
        console.error('Error generating thumbnail:', err);
        reject(err);
      })
      .screenshots({
        timestamps: ['50%'], // Take screenshot from middle of video
        filename: basename(thumbnailPath),
        folder: dir,
        size: '720x?', // 720p width, maintain aspect ratio
      });
  });
}

async function main() {
  try {
    console.log('Generating thumbnail...');
    const videoPath = join(__dirname, '..', 'video.mp4');
    const thumbnailPath = await generateThumbnail(videoPath);
    console.log('Thumbnail generated at:', thumbnailPath);
  } catch (error) {
    console.error('Error generating thumbnail:', error);
  }
}

main(); 