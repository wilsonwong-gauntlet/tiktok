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
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

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

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

interface Quiz {
  id: string;
  videoId: string;
  questions: QuizQuestion[];
}

interface GenerateQuizRequest {
  videoId: string;
  transcription: string;
}

/**
 * Attempts to parse an OpenAI response into a valid quiz format.
 * Handles multiple possible response formats and extracts valid questions.
 * @param {unknown} response - The response from OpenAI to parse
 * @return {QuizQuestion[]} An array of valid quiz questions
 */
function parseQuizResponse(response: unknown): QuizQuestion[] {
  logger.info("Attempting to parse quiz response");

  if (isQuizResponse(response)) {
    const validQuestions = response.questions.filter(isValidQuestion);
    if (validQuestions.length > 0) {
      logger.info("Found valid questions in expected format");
      return validQuestions;
    }
  }

  if (Array.isArray(response)) {
    const validQuestions = response.filter(isValidQuestion);
    if (validQuestions.length > 0) {
      logger.info("Found valid questions in array format");
      return validQuestions;
    }
  }

  if (typeof response === "string" || hasContent(response)) {
    const content = hasContent(response) ? response.content : response;
    const questions: QuizQuestion[] = [];
    const questionBlocks = content.split(/Question \d+:|Q\d+:/);

    for (const block of questionBlocks) {
      if (!block.trim()) continue;
      try {
        const parsedQuestion = parseQuestionBlock(block);
        if (parsedQuestion) {
          questions.push({
            id: `q${questions.length + 1}`,
            ...parsedQuestion,
          });
        }
      } catch (error) {
        logger.warn("Failed to parse question block:", error);
        continue;
      }
    }

    if (questions.length > 0) {
      logger.info("Successfully extracted questions from text format");
      return questions;
    }
  }

  logger.error("Could not parse response into valid quiz format:", response);
  throw new Error("Could not parse response into valid quiz format");
}

interface QuizResponse {
  questions: unknown[];
}

/**
 * Type guard to check if a value is a QuizResponse.
 * @param {unknown} value - The value to check
 * @return {boolean} True if the value is a QuizResponse
 */
function isQuizResponse(value: unknown): value is QuizResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "questions" in value &&
    Array.isArray((value as QuizResponse).questions)
  );
}

/**
 * Type guard to check if a value has a content property.
 * @param {unknown} value - The value to check
 * @return {boolean} True if the value has a content property
 */
function hasContent(value: unknown): value is { content: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    typeof (value as { content: string }).content === "string"
  );
}

/**
 * Type guard to check if a value is a valid QuizQuestion.
 * @param {unknown} q - The value to check
 * @return {boolean} True if the value is a valid QuizQuestion
 */
function isValidQuestion(q: unknown): q is QuizQuestion {
  return (
    typeof q === "object" &&
    q !== null &&
    "question" in q &&
    typeof (q as QuizQuestion).question === "string" &&
    "options" in q &&
    Array.isArray((q as QuizQuestion).options) &&
    (q as QuizQuestion).options.length === 4 &&
    "correctOptionIndex" in q &&
    typeof (q as QuizQuestion).correctOptionIndex === "number" &&
    (q as QuizQuestion).correctOptionIndex >= 0 &&
    (q as QuizQuestion).correctOptionIndex <= 3 &&
    "explanation" in q &&
    typeof (q as QuizQuestion).explanation === "string"
  );
}

interface ParsedQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

/**
 * Parses a block of text into a quiz question.
 * @param {string} block - The text block to parse
 * @return {ParsedQuestion | null} The parsed question or null if invalid
 */
function parseQuestionBlock(block: string): ParsedQuestion | null {
  const questionMatch = block.match(/^([^\n]+)/);
  const optionsMatch = block.match(/(?:[A-D][\s)]+([^\n]+))/g);
  const correctMatch = block.match(
    /(?:Correct Answer|Answer|Index):?\s*([A-D]|[0-3])/i
  );
  const explanationMatch = block.match(/(?:Explanation|Reason):?\s*([^\n]+)/i);

  if (!questionMatch || !optionsMatch?.length || !correctMatch) {
    return null;
  }

  const question = questionMatch[1].trim();
  const options = optionsMatch.map((opt: string) =>
    opt.replace(/^[A-D][\s)]+/, "").trim()
  );
  const correctOption = correctMatch[1].trim();
  const correctOptionIndex = isNaN(Number(correctOption)) ?
    "ABCD".indexOf(correctOption) :
    Number(correctOption);
  const explanation = explanationMatch ?
    explanationMatch[1].trim() :
    "Correct answer based on video content";

  if (correctOptionIndex >= 0 && correctOptionIndex <= 3) {
    return {
      question,
      options,
      correctOptionIndex,
      explanation,
    };
  }

  return null;
}

export const generateQuiz = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request: CallableRequest<GenerateQuizRequest>) => {
    try {
      const {videoId, transcription} = request.data;

      if (!videoId || !transcription) {
        throw new Error(
          "Missing required parameters: videoId and transcription",
        );
      }

      logger.info("Starting quiz generation for video:", videoId);
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

      // Prepare the prompt for GPT
      const prompt = [
        "Generate a quiz based on the following video transcription.",
        "The quiz should test understanding of key concepts and details.",
        "Create 5 multiple-choice questions, each with 4 options.",
        "For each question, provide:",
        "1. A clear question",
        "2. Four options (with one correct answer)",
        "3. The index of the correct option (0-3)",
        "4. A brief explanation of why the answer is correct",
        "",
        "Return a JSON object with this exact structure:",
        "{",
        "  \"questions\": [",
        "    {",
        "      \"question\": \"string\",",
        "      \"options\": [\"string\", \"string\", \"string\", \"string\"],",
        "      \"correctOptionIndex\": number,",
        "      \"explanation\": \"string\"",
        "    }",
        "  ]",
        "}",
        "",
        "Transcription:",
        transcription,
      ].join("\n");

      logger.info("Calling OpenAI API for quiz generation...");

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: [
              "You are an expert at creating educational assessments.",
              "Always return valid JSON matching the exact",
              "structure requested.",
            ].join(" "),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: {
          type: "json_object",
        },
      });

      logger.info("Received response from OpenAI");

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error("Failed to get response from OpenAI");
      }

      logger.info("Processing OpenAI response");

      // Parse the response
      const parsedResponse = JSON.parse(response);
      logger.info("Parsed response:", parsedResponse);

      // Try to parse the response into our expected format
      const questions = parseQuizResponse(parsedResponse);

      // Ensure we have at least 3 valid questions
      if (questions.length < 3) {
        logger.error("Not enough valid questions found:", questions);
        throw new Error("Not enough valid questions generated");
      }

      const quiz: Quiz = {
        id: `quiz_${videoId}`,
        videoId,
        questions: questions.slice(0, 5), // Take up to 5 questions
      };

      logger.info("Successfully generated quiz:", quiz);

      return quiz;
    } catch (error) {
      logger.error("Error in generateQuiz:", error);
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

interface FurtherReading {
  title: string;
  author: string;
  description: string;
}

interface GenerateFurtherReadingRequest {
  videoId: string;
  transcription: string;
  summary?: VideoSummary;
}

export const generateFurtherReading = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request: CallableRequest<GenerateFurtherReadingRequest>) => {
    try {
      const {videoId, transcription, summary} = request.data;

      if (!videoId || !transcription) {
        throw new Error(
          "Missing required parameters: videoId and transcription"
        );
      }

      logger.info("Starting further reading generation for video:", videoId);

      // Get the API key and verify it's not empty
      const apiKey = openaiApiKey.value();
      if (!apiKey) {
        logger.error("OpenAI API key is not set");
        throw new Error("OpenAI API key is not configured");
      }

      // Initialize OpenAI client with the secret at runtime
      const openai = new OpenAI({apiKey});

      logger.info("OpenAI client initialized");

      // Prepare the prompt for GPT
      const prompt = [
        "Based on this video transcription, recommend 2-3 foundational books",
        "or papers that would help someone understand this topic deeply.",
        "Keep the recommendations concise with just title, author,",
        "and a brief description.",
        "",
        summary ? "Key concepts from the video:" : "",
        summary ? summary.main_concepts.map((c) => `- ${c}`).join("\n") : "",
        "",
        "Transcription:",
        transcription,
        "",
        "Return recommendations in this exact JSON format:",
        "{",
        "  \"recommendations\": [",
        "    {",
        "      \"title\": \"string (book/paper title)\",",
        "      \"author\": \"string (author name)\",",
        "      \"description\": \"string (1-2 sentences about the work)\"",
        "    }",
        "  ]",
        "}",
      ].join("\n");

      logger.info("Calling OpenAI API for further reading recommendations...");

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: [
              "You are an expert academic librarian and researcher.",
              "Recommend only high-quality, dense resources that provide deep,",
              "systematic understanding. Focus on foundational works and",
              "theoretical frameworks.",
            ].join(" "),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: {type: "json_object"},
      });

      logger.info("Received response from OpenAI");

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error("Failed to get response from OpenAI");
      }

      // Parse and validate the response
      const parsedResponse = JSON.parse(response);
      if (
        !parsedResponse.recommendations ||
        !Array.isArray(parsedResponse.recommendations)
      ) {
        throw new Error("Invalid response format");
      }

      const recommendations =
        parsedResponse.recommendations as FurtherReading[];

      // Validate each recommendation with proper line breaks
      const validRecommendations = recommendations.filter((rec) => {
        return rec.title && rec.author && rec.description;
      });

      if (validRecommendations.length < 2) {
        throw new Error("Not enough valid recommendations generated");
      }

      logger.info(
        "Successfully generated further reading recommendations:",
        validRecommendations
      );

      // Save recommendations to Firestore
      const videoRef = admin.firestore().collection("videos").doc(videoId);
      await videoRef.update({
        furtherReading: validRecommendations,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info("Saved recommendations to Firestore");

      return validRecommendations;
    } catch (error) {
      logger.error("Error in generateFurtherReading:", error);
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
