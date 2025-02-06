import { db } from './firebase-admin';
import { Video } from '../types/video';
import { prompt } from 'inquirer';

const VIDEOS_COLLECTION = 'videos';
const SUBJECTS_COLLECTION = 'subjects';
const CONCEPTS_COLLECTION = 'concepts';

async function listSubjects() {
  const snapshot = await db.collection(SUBJECTS_COLLECTION).get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name
  }));
}

async function listConcepts(subjectId: string) {
  const snapshot = await db.collection(CONCEPTS_COLLECTION)
    .where('subjectId', '==', subjectId)
    .get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name
  }));
}

async function updateVideoRelationships() {
  try {
    // List all subjects
    const subjects = await listSubjects();
    const { subjectId } = await prompt({
      type: 'list',
      name: 'subjectId',
      message: 'Select the primary subject:',
      choices: subjects.map(s => ({ name: s.name, value: s.id }))
    });

    // List concepts for the selected subject
    const concepts = await listConcepts(subjectId);
    const { conceptIds } = await prompt({
      type: 'checkbox',
      name: 'conceptIds',
      message: 'Select the concepts covered in this video:',
      choices: concepts.map(c => ({ name: c.name, value: c.id }))
    });

    // List videos without relationships
    const videosSnapshot = await db.collection(VIDEOS_COLLECTION)
      .where('subjectId', '==', null)
      .limit(10)
      .get();

    if (videosSnapshot.empty) {
      console.log('No videos found without subject relationships.');
      return;
    }

    // Update each video
    const batch = db.batch();
    videosSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        subjectId,
        conceptIds,
        updatedAt: new Date()
      });
    });

    await batch.commit();
    console.log(`Updated ${videosSnapshot.size} videos with subject and concept relationships.`);

  } catch (error) {
    console.error('Error updating video relationships:', error);
  }
}

async function assignConceptsToVideo(videoId: string) {
  try {
    // Get video data
    const videoDoc = await db.collection(VIDEOS_COLLECTION).doc(videoId).get();
    if (!videoDoc.exists) {
      console.log('Video not found');
      return;
    }

    const video = videoDoc.data() as Video;
    console.log(`\nUpdating concepts for video: ${video.title}`);

    // List all subjects
    const subjects = await listSubjects();
    const { subjectId } = await prompt({
      type: 'list',
      name: 'subjectId',
      message: 'Select the primary subject:',
      choices: subjects.map(s => ({ name: s.name, value: s.id }))
    });

    // List concepts for the selected subject
    const concepts = await listConcepts(subjectId);
    const { conceptIds } = await prompt({
      type: 'checkbox',
      name: 'conceptIds',
      message: 'Select the concepts covered in this video:',
      choices: concepts.map(c => ({ name: c.name, value: c.id }))
    });

    // Update the video
    await videoDoc.ref.update({
      subjectId,
      conceptIds,
      updatedAt: new Date()
    });

    console.log('Successfully updated video relationships');

  } catch (error) {
    console.error('Error assigning concepts to video:', error);
  }
}

// Command line interface
async function main() {
  const { action } = await prompt({
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'Update videos without relationships', value: 'update' },
      { name: 'Assign concepts to a specific video', value: 'assign' }
    ]
  });

  if (action === 'update') {
    await updateVideoRelationships();
  } else {
    const { videoId } = await prompt({
      type: 'input',
      name: 'videoId',
      message: 'Enter the video ID:'
    });
    await assignConceptsToVideo(videoId);
  }
}

main(); 