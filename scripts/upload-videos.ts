import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, basename, join, dirname } from 'path';
import * as readline from 'readline';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { uploadLocalVideo } from './video-service';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
  'Entertainment'
];

async function selectFromOptions(options: string[], customAllowed = true): Promise<string> {
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
  console.log('Select category:');
  const category = await selectFromOptions(COMMON_CATEGORIES);
  
  const commonTagsInput = await question('Common tags for all videos (comma-separated): ');
  const commonTags = commonTagsInput.split(',').map(tag => tag.trim());
  
  return { category, commonTags };
}

async function generateThumbnail(videoPath: string): Promise<string> {
  const thumbnailDir = join(dirname(videoPath), 'thumbnails');
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
        timestamps: ['50%'], // Take screenshot from middle of video
        filename: basename(thumbnailPath),
        folder: thumbnailDir,
        size: '720x?', // 720p width, maintain aspect ratio
      });
  });
}

async function convertToMp4(inputPath: string): Promise<string> {
  const outputPath = join(dirname(inputPath), `${basename(inputPath, '.webm')}.mp4`);
  
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

async function uploadVideo(filePath: string, commonMetadata?: { category: string; commonTags: string[] }) {
  try {
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return null;
    }

    // Convert WebM to MP4 if necessary
    let processedFilePath = filePath;
    if (filePath.toLowerCase().endsWith('.webm')) {
      console.log('Converting WebM to MP4...');
      try {
        processedFilePath = await convertToMp4(filePath);
        console.log('Conversion completed:', processedFilePath);
      } catch (error) {
        console.error('Failed to convert video:', error);
        return null;
      }
    }

    // Get video metadata from user input
    console.log(`\nEnter details for ${basename(filePath)}:`);
    const title = await question('Title: ');
    const description = await question('Description: ');
    
    // Use common category or ask for specific one
    const category = commonMetadata?.category || await selectFromOptions(COMMON_CATEGORIES);
    
    // Combine common tags with video-specific tags
    const specificTagsInput = await question('Additional tags for this video (comma-separated): ');
    const specificTags = specificTagsInput.split(',').map(tag => tag.trim()).filter(Boolean);
    const tags = [...(commonMetadata?.commonTags || []), ...specificTags];

    // Generate thumbnail
    console.log('Generating thumbnail...');
    const thumbnailPath = await generateThumbnail(processedFilePath);
    console.log('Thumbnail generated:', thumbnailPath);

    // Prepare video data
    const videoData = {
      filePath: resolve(processedFilePath),
      thumbnailPath,
      title,
      description,
      category,
      tags,
      authorId: 'manual-upload',
      authorName: 'Manual Upload'
    };

    // Upload the video
    console.log('\nUploading video...');
    const videoId = await uploadLocalVideo(videoData);
    console.log(`Video uploaded successfully! Video ID: ${videoId}`);

    // Clean up converted file if it was created
    if (processedFilePath !== filePath && existsSync(processedFilePath)) {
      try {
        unlinkSync(processedFilePath);
        console.log('Cleaned up converted file');
      } catch (error) {
        console.warn('Failed to clean up converted file:', error);
      }
    }

    return videoId;
  } catch (error) {
    console.error('Error uploading video:', error);
    return null;
  }
}

async function main() {
  try {
    // Get video file paths from command line arguments
    const filePaths = process.argv.slice(2);
    if (filePaths.length === 0) {
      console.error('Please provide at least one video file path');
      process.exit(1);
    }

    console.log(`Found ${filePaths.length} videos to upload`);
    
    // Ask if user wants to enter common metadata
    const useCommonMetadata = await question('Do you want to enter common metadata for all videos? (y/n): ');
    const commonMetadata = useCommonMetadata.toLowerCase() === 'y' ? 
      await getCommonMetadata() : undefined;

    // Upload videos sequentially
    const results = [];
    for (const filePath of filePaths) {
      const result = await uploadVideo(filePath, commonMetadata);
      results.push({ filePath, success: !!result, videoId: result });
    }

    // Print summary
    console.log('\nUpload Summary:');
    results.forEach(({ filePath, success, videoId }) => {
      console.log(`${basename(filePath)}: ${success ? `Success (ID: ${videoId})` : 'Failed'}`);
    });
    
    // Close readline interface
    rl.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 