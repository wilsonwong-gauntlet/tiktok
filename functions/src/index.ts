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
  {
    secrets: [openaiApiKey],
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request: CallableRequest<GenerateVideoSummaryRequest>) => {
    try {
      const {videoId, transcription} = request.data;

      if (!videoId || !transcription) {
        throw new Error(
          "Missing required parameters: videoId and transcription",
        );
      }

      logger.info("Starting summary generation for video:", videoId);
      logger.info("Transcription length:", transcription.length);

      // Get the API key and verify it's not empty
      const apiKey = openaiApiKey.value();
      if (!apiKey) {
        logger.error("OpenAI API key is not set");
        throw new Error("OpenAI API key is not configured");
      }

      // Initialize OpenAI client with the secret at runtime
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      logger.info("OpenAI client initialized");

      // Verify API key by making a small test request
      try {
        await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{role: "user", content: "test"}],
          max_tokens: 1,
        });
        logger.info("OpenAI API key verified successfully");
      } catch (error) {
        logger.error("OpenAI API key verification failed:", error);
        if (error instanceof OpenAI.APIError) {
          if (error.status === 401) {
            throw new Error("Invalid OpenAI API key");
          }
        }
        throw error;
      }

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

      logger.info("Calling OpenAI API for summary generation...");

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

      logger.info("Received response from OpenAI");

      // Process the response
      const response = completion.choices[0].message.content;

      if (!response) {
        throw new Error("Failed to get response from OpenAI");
      }

      logger.info("Processing OpenAI response");

      // Parse the response into structured format
      const keyPointsMatch = response.match(
        /Key Points:[\s\S]*?(?=Main Concepts:|$)/i,
      );
      const mainConceptsMatch = response.match(/Main Concepts:[\s\S]*/i);

      if (!keyPointsMatch || !mainConceptsMatch) {
        logger.error("Failed to parse OpenAI response:", response);
        throw new Error("Failed to parse OpenAI response format");
      }

      const keyPoints = keyPointsMatch[0]
        .replace(/Key Points:/i, "")
        .split("\n")
        .map((point) => point.replace(/^[•\-\d.]\s*/, "").trim())
        .filter((point) => point.length > 0);

      const mainConcepts = mainConceptsMatch[0]
        .replace(/Main Concepts:/i, "")
        .split("\n")
        .map((concept) => concept.replace(/^[•\-\d.]\s*/, "").trim())
        .filter((concept) => concept.length > 0);

      if (keyPoints.length === 0 || mainConcepts.length === 0) {
        logger.error("No key points or main concepts found in response:", {
          response,
          keyPoints,
          mainConcepts,
        });
        throw new Error("Failed to extract key points or main concepts");
      }

      const summary: VideoSummary = {
        key_points: keyPoints,
        main_concepts: mainConcepts,
        generated_at: new Date(),
      };

      logger.info("Successfully generated summary:", summary);

      return summary;
    } catch (error) {
      logger.error("Error in generateVideoSummary:", error);
      if (error instanceof OpenAI.APIError) {
        logger.error("OpenAI API Error:", {
          status: error.status,
          message: error.message,
          type: error.type,
        });
        // Provide more specific error messages based on OpenAI error types
        if (error.status === 401) {
          throw new Error("Authentication error: Invalid OpenAI API key");
        } else if (error.status === 429) {
          throw new Error("Rate limit exceeded: Too many requests to OpenAI");
        } else if (error.status === 500) {
          throw new Error("OpenAI service error: Please try again later");
        }
      }
      throw error;
    }
  },
);
