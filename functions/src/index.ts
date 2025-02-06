/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onCall, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";
import {defineSecret} from "firebase-functions/params";

// Define secrets
const openaiApiKey = defineSecret("OPENAI_API_KEY");

interface VideoSummary {
  key_points: string[];
  main_concepts: string[];
  generated_at: Date;
}

interface GenerateVideoSummaryRequest {
  videoId: string;
  transcription: string;
}

export const generateVideoSummary = onCall(
  {secrets: [openaiApiKey]},
  async (request: CallableRequest<GenerateVideoSummaryRequest>) => {
    try {
      const {videoId, transcription} = request.data;

      if (!videoId || !transcription) {
        throw new Error(
          "Missing required parameters: videoId and transcription",
        );
      }

      logger.info("Generating summary for video:", videoId);

      // Initialize OpenAI client with the secret at runtime
      const openai = new OpenAI({
        apiKey: openaiApiKey.value(),
      });

      // Prepare the prompt for GPT
      const prompt = [
        "Please analyze this video transcription and provide a structured",
        "summary. Focus on the key points and main concepts discussed.",
        "",
        "Transcription:",
        transcription,
        "",
        "Please provide the summary in the following format:",
        "1. Key Points: List the 3-5 most important points discussed",
        "2. Main Concepts: List 2-3 core concepts or theories mentioned",
      ].join("\n");

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing educational content and " +
              "creating concise, informative summaries.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      // Process the response
      const response = completion.choices[0].message.content;

      if (!response) {
        throw new Error("Failed to get response from OpenAI");
      }

      // Parse the response into structured format
      const keyPointsMatch = response.match(
        /Key Points:[\s\S]*?(?=Main Concepts:|$)/i,
      );
      const mainConceptsMatch = response.match(/Main Concepts:[\s\S]*/i);

      const keyPoints = keyPointsMatch ?
        keyPointsMatch[0]
          .replace(/Key Points:/i, "")
          .split("\n")
          .map((point) => point.replace(/^[•\-\d.]\s*/, "").trim())
          .filter((point) => point.length > 0) :
        [];

      const mainConcepts = mainConceptsMatch ?
        mainConceptsMatch[0]
          .replace(/Main Concepts:/i, "")
          .split("\n")
          .map((concept) => concept.replace(/^[•\-\d.]\s*/, "").trim())
          .filter((concept) => concept.length > 0) :
        [];

      const summary: VideoSummary = {
        key_points: keyPoints,
        main_concepts: mainConcepts,
        generated_at: new Date(),
      };

      logger.info("Successfully generated summary:", summary);

      return summary;
    } catch (error) {
      logger.error("Error generating summary:", error);
      throw new Error("Failed to generate video summary");
    }
  },
);
