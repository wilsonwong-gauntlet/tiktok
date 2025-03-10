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
import {
  getFirestore,
  DocumentData,
  QueryDocumentSnapshot,
  CollectionReference,
  DocumentReference,
  Query,
  WhereFilterOp,
} from "firebase-admin/firestore";
import {UserProgress} from "../../types/video";

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Firestore
const db = getFirestore();

// Define allowed types for Firestore query values
type WhereValue = string | number | boolean | null | Date | DocumentReference | Array<string | number | boolean | null | Date | DocumentReference>;

// Helper functions for Firestore operations
const createRef = {
  collection: (path: string): CollectionReference => db.collection(path),
  doc: (collectionPath: string, ...pathSegments: string[]): DocumentReference =>
    db.collection(collectionPath).doc(pathSegments.join("/")),
};

const createQuery = {
  where: (
    collection: CollectionReference,
    field: string,
    op: WhereFilterOp,
    value: WhereValue
  ): Query => collection.where(field, op, value),
};

const dbOperations = {
  getDoc: async (ref: DocumentReference) => {
    const snapshot = await ref.get();
    return {
      data: () => snapshot.data(),
      exists: snapshot.exists,
    };
  },
  getDocs: async (ref: Query | CollectionReference) => {
    const snapshot = await ref.get();
    return {
      docs: snapshot.docs,
      empty: snapshot.empty,
      size: snapshot.size,
    };
  },
  update: async (ref: DocumentReference, data: Partial<DocumentData>) => ref.update(data),
};

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

interface GenerateCommentSummaryRequest {
  videoId: string;
}

interface CommentSummaryResponse {
  success: boolean;
  reason?: string;
  summary?: {
    summary: string;
    confusionPoints: string[];
    valuableInsights: string[];
    sentiment: string;
  };
}

interface CommentSummaryFormat {
  summary: string;
  confusionPoints: string[];
  valuableInsights: string[];
  sentiment: string;
}

/**
 * Attempts to parse an OpenAI response into a valid comment summary format.
 * Handles multiple possible response formats and validates the structure.
 * @param {unknown} response - The response from OpenAI to parse
 * @return {CommentSummaryFormat} A validated comment summary
 */
function parseCommentSummaryResponse(response: unknown): CommentSummaryFormat {
  logger.info("Attempting to parse comment summary response");

  // Case 1: Direct valid JSON object
  if (isValidCommentSummary(response)) {
    logger.info("Found valid summary in direct format");
    return response;
  }

  // Case 2: String that needs to be parsed
  if (typeof response === "string") {
    try {
      const parsed = JSON.parse(response);
      if (isValidCommentSummary(parsed)) {
        logger.info("Successfully parsed string response into valid format");
        return parsed;
      }
    } catch (error) {
      logger.warn("Failed to parse string response as JSON");
    }
  }

  // Case 3: Attempt to extract from markdown or text format
  if (typeof response === "string") {
    try {
      return extractSummaryFromText(response);
    } catch (error) {
      logger.warn("Failed to extract summary from text format");
    }
  }

  logger.error("Could not parse response into valid summary format:", response);
  throw new Error("Could not parse response into valid summary format");
}

/**
 * Type guard to check if a value is a valid CommentSummaryFormat.
 * @param {unknown} value - The value to check
 * @return {boolean} True if the value is a valid CommentSummaryFormat
 */
function isValidCommentSummary(value: unknown): value is CommentSummaryFormat {
  if (typeof value !== "object" || value === null) return false;

  const summary = value as Partial<CommentSummaryFormat>;

  return (
    typeof summary.summary === "string" &&
    Array.isArray(summary.confusionPoints) &&
    summary.confusionPoints.every((point) => typeof point === "string") &&
    Array.isArray(summary.valuableInsights) &&
    summary.valuableInsights.every((insight) => typeof insight === "string") &&
    typeof summary.sentiment === "string"
  );
}

/**
 * Attempts to extract summary components from a text format response.
 * @param {string} text - The text to parse
 * @return {CommentSummaryFormat} The extracted summary
 */
function extractSummaryFromText(text: string): CommentSummaryFormat {
  const summaryMatch = text.match(/Summary:?\s*([^\n]+)/i);
  const confusionMatch = text.match(/Confusion Points?:?\s*([\s\S]*?)(?=Valuable Insights?:|Sentiment:|$)/i);
  const insightsMatch = text.match(/Valuable Insights?:?\s*([\s\S]*?)(?=Sentiment:|$)/i);
  const sentimentMatch = text.match(/Sentiment:?\s*([^\n]+)/i);

  if (!summaryMatch || !confusionMatch || !insightsMatch || !sentimentMatch) {
    throw new Error("Could not extract all required sections from text");
  }

  const summary = summaryMatch[1].trim();
  const confusionPoints = confusionMatch[1]
    .split(/\n/)
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter((line) => line.length > 0);
  const valuableInsights = insightsMatch[1]
    .split(/\n/)
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter((line) => line.length > 0);
  const sentiment = sentimentMatch[1].trim();

  return {
    summary,
    confusionPoints,
    valuableInsights,
    sentiment,
  };
}

export const generateCommentSummary = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request: CallableRequest<GenerateCommentSummaryRequest>): Promise<CommentSummaryResponse> => {
    try {
      logger.info("=== Starting generateCommentSummary function ===");
      logger.info("Request data:", {
        auth: request.auth ? {
          uid: request.auth.uid,
          token: request.auth.token,
        } : null,
        app: request.app,
        rawRequest: request.rawRequest ? {
          headers: request.rawRequest.headers,
          method: request.rawRequest.method,
        } : null,
      });

      const {videoId} = request.data;
      if (!videoId) {
        const error = "Missing required parameter: videoId";
        logger.error(error);
        return {
          success: false,
          reason: error,
        };
      }

      logger.info("Starting comment summary generation for video:", {
        videoId,
        timestamp: new Date().toISOString(),
      });

      // Get the API key and verify it's not empty
      const apiKey = openaiApiKey.value();
      if (!apiKey) {
        const error = "OpenAI API key is not configured";
        logger.error(error);
        return {
          success: false,
          reason: error,
        };
      }

      logger.info("API key verified successfully");

      // Initialize OpenAI client with the secret at runtime
      const openai = new OpenAI({apiKey});
      logger.info("OpenAI client initialized successfully");

      // Get all comments for this video
      let commentsSnapshot;
      try {
        logger.info("Fetching comments from Firestore for video:", videoId);
        commentsSnapshot = await admin.firestore()
          .collection("comments")
          .where("videoId", "==", videoId)
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();

        logger.info("Successfully fetched comments from Firestore", {
          commentCount: commentsSnapshot.size,
          empty: commentsSnapshot.empty,
        });
      } catch (error) {
        logger.error("Error fetching comments from Firestore:", {
          error,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
          videoId,
        });
        return {
          success: false,
          reason: "Failed to fetch comments",
        };
      }

      const comments = commentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        content: doc.data().content,
        likes: doc.data().likes || 0,
        createdAt: doc.data().createdAt,
      }));

      logger.info("Processed comments data:", {
        commentCount: comments.length,
        hasLikes: comments.some((c) => c.likes > 0),
        oldestComment: comments[comments.length - 1]?.createdAt,
        newestComment: comments[0]?.createdAt,
      });

      if (comments.length < 5) {
        logger.info("Insufficient comments for summarization:", {
          commentCount: comments.length,
          requiredCount: 5,
        });
        return {
          success: false,
          reason: "Not enough comments",
        };
      }

      // Prepare the prompt for GPT
      const prompt = [
        "Analyze these comments from a learning video and create a structured summary.",
        "You must respond with a valid JSON object containing exactly these fields:",
        "{",
        "  \"summary\": \"A concise 2-3 sentence summary of the main discussion points\",",
        "  \"confusionPoints\": [\"List of areas where students expressed confusion or questions\"],",
        "  \"valuableInsights\": [\"List of most valuable contributions or insights shared\"],",
        "  \"sentiment\": \"Overall sentiment and engagement level description\"",
        "}",
        "",
        "Comments to analyze (most recent first):",
        comments.map((c) => `- ${c.content} (${c.likes} likes)`).join("\n"),
      ].join("\n");

      logger.info("Prepared OpenAI prompt", {
        promptLength: prompt.length,
        commentCount: comments.length,
      });

      let completion;
      try {
        logger.info("Calling OpenAI API with configuration:", {
          model: "gpt-4-turbo-preview",
          maxTokens: 1000,
          temperature: 0.7,
          responseFormat: "json_object",
        });

        // Call OpenAI API
        completion = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: [
                "You are an expert at analyzing educational discussions.",
                "You must ALWAYS respond with a valid JSON object that exactly matches",
                "the structure specified in the prompt. Each field is required.",
                "The response must be parseable JSON with no markdown or other formatting.",
              ].join(" "),
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: {type: "json_object"},
        });

        logger.info("Received response from OpenAI:", {
          completionId: completion.id,
          model: completion.model,
          usage: completion.usage,
        });

        // Log the raw response for debugging
        logger.info("Raw OpenAI response:", {
          content: completion.choices[0].message.content,
        });
      } catch (error) {
        const errorDetails = error instanceof OpenAI.APIError ? {
          status: error.status,
          message: error.message,
          type: error.type,
          code: error.code,
        } : undefined;

        logger.error("Error calling OpenAI API:", {
          error,
          errorType: error instanceof OpenAI.APIError ?
            "OpenAI.APIError" : "Unknown",
          errorDetails,
          stack: error instanceof Error ? error.stack : undefined,
        });

        if (error instanceof OpenAI.APIError) {
          logger.error("OpenAI API Error details:", {
            status: error.status,
            message: error.message,
            type: error.type,
          });

          const errorMessage = error.status === 401 ?
            "Authentication error: Invalid OpenAI API key" :
            error.status === 429 ?
              "Rate limit exceeded: Too many requests to OpenAI" :
              error.status === 500 ?
                "OpenAI service error: Please try again later" :
                "Failed to generate summary with AI";

          return {
            success: false,
            reason: errorMessage,
          };
        }

        return {
          success: false,
          reason: "Failed to generate summary with AI",
        };
      }

      const response = completion.choices[0].message.content;
      if (!response) {
        logger.error("Empty response from OpenAI");
        return {
          success: false,
          reason: "Failed to get response from OpenAI",
        };
      }

      let summary;
      try {
        // Use the new parser that handles multiple formats
        summary = parseCommentSummaryResponse(response);
        logger.info("Successfully parsed OpenAI response:", {
          summaryLength: summary.summary.length,
          confusionPointsCount: summary.confusionPoints.length,
          valuableInsightsCount: summary.valuableInsights.length,
          sentimentLength: summary.sentiment.length,
        });
      } catch (error) {
        logger.error("Error parsing OpenAI response:", {
          error,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
          rawResponse: response,
        });
        return {
          success: false,
          reason: "Failed to parse AI response",
        };
      }

      try {
        logger.info("Updating Firestore with summary", {
          videoId,
          summaryLength: summary.summary.length,
          confusionPointsCount: summary.confusionPoints.length,
          valuableInsightsCount: summary.valuableInsights.length,
        });

        // Update the video document with the new summary
        await admin.firestore()
          .collection("videos")
          .doc(videoId)
          .update({
            commentSummary: {
              ...summary,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              commentCount: comments.length,
            },
          });
        logger.info("Successfully updated video document with summary");
      } catch (error) {
        logger.error("Error updating Firestore:", {
          error,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
          videoId,
        });
        return {
          success: false,
          reason: "Failed to save summary",
        };
      }

      logger.info("=== Successfully completed generateCommentSummary function ===", {
        videoId,
        commentCount: comments.length,
        summaryGenerated: true,
      });

      return {
        success: true,
        summary,
      };
    } catch (error) {
      logger.error("Unhandled error in generateCommentSummary:", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        reason: error instanceof Error ? error.message : "An unexpected error occurred",
      };
    }
  },
);

interface CoachingPrompt {
  text: string;
  timestamp: number; // When to show the prompt (in seconds)
  type: "reflection" | "action" | "connection";
}

interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
}

interface GenerateCoachingPromptsRequest {
  videoId: string;
}

interface GenerateCoachingPromptsResponse {
  success: boolean;
  reason?: string;
  prompts?: CoachingPrompt[];
}

export const generateCoachingPrompts = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request: CallableRequest<GenerateCoachingPromptsRequest>): Promise<GenerateCoachingPromptsResponse> => {
    try {
      logger.info("=== Starting generateCoachingPrompts function ===");
      logger.info("Request data:", {
        auth: request.auth ? {
          uid: request.auth.uid,
          token: request.auth.token,
        } : null,
        app: request.app,
        rawRequest: request.rawRequest ? {
          headers: request.rawRequest.headers,
          method: request.rawRequest.method,
        } : null,
      });

      // Check authentication
      if (!request.auth) {
        const error = "User must be authenticated to generate coaching prompts";
        logger.error(error);
        return {
          success: false,
          reason: error,
        };
      }

      const {videoId} = request.data;
      if (!videoId) {
        const error = "Missing required parameter: videoId";
        logger.error(error);
        return {
          success: false,
          reason: error,
        };
      }

      // Get video document
      const videoDoc = await admin.firestore().collection("videos").doc(videoId).get();
      if (!videoDoc.exists) {
        const error = "Video not found";
        logger.error(error);
        return {
          success: false,
          reason: error,
        };
      }

      const videoData = videoDoc.data();
      if (!videoData?.transcriptionSegments || videoData.transcriptionStatus !== "completed") {
        const error = "Video transcription segments are not available";
        logger.error(error);
        return {
          success: false,
          reason: error,
        };
      }

      // Get the API key and verify it's not empty
      const apiKey = openaiApiKey.value();
      if (!apiKey) {
        const error = "OpenAI API key is not configured";
        logger.error(error);
        return {
          success: false,
          reason: error,
        };
      }

      // Initialize OpenAI client with the secret at runtime
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      // Process segments in batches to generate prompts
      const segments = videoData.transcriptionSegments as TranscriptionSegment[];
      const prompts: CoachingPrompt[] = [];

      logger.info("Processing segments for prompts generation:", {
        segmentsCount: segments.length,
      });

      // Process every few segments to create contextual prompts
      for (let i = 0; i < segments.length; i += 3) {
        const contextSegments = segments.slice(i, i + 3);
        const combinedText = contextSegments.map((s: TranscriptionSegment) => s.text).join(" ");
        const timestamp = contextSegments[0].start;

        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are an expert educational coach. Your task is to generate engaging prompts that help students reflect on and internalize the content they're learning. 
              Focus on creating prompts that:
              1. Encourage critical thinking
              2. Help connect concepts to real-world applications
              3. Promote deeper understanding through reflection
              4. Build connections with prior knowledge
              
              Generate ONE prompt based on the given context. The prompt should be concise (1-2 sentences) and directly related to the content.
              Return ONLY the prompt text, nothing else.`,
            },
            {
              role: "user",
              content: combinedText,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        });

        const promptText = response.choices[0].message.content?.trim();
        if (promptText) {
          prompts.push({
            text: promptText,
            timestamp,
            type: "reflection", // We could make this more dynamic based on content analysis
          });
        }
      }

      logger.info("Generated prompts:", {
        promptCount: prompts.length,
      });

      // Store the prompts in Firestore
      try {
        await videoDoc.ref.update({
          coachingPrompts: prompts,
          promptsGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info("Successfully stored prompts in Firestore");
      } catch (error) {
        logger.error("Error storing prompts in Firestore:", error);
        return {
          success: false,
          reason: "Failed to store prompts",
        };
      }

      logger.info("=== Successfully completed generateCoachingPrompts function ===");
      return {
        success: true,
        prompts,
      };
    } catch (error) {
      logger.error("Unhandled error in generateCoachingPrompts:", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        reason: error instanceof Error ? error.message : "An unexpected error occurred",
      };
    }
  },
);

interface SmartSeekResult {
  timestamp: number;
  confidence: number;
  previewThumbnail?: string;
  context: string;
}

interface SmartSeekRequest {
  videoId: string;
  query: string;
}

export const smartSeek = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request: CallableRequest<SmartSeekRequest>): Promise<{results: SmartSeekResult[]}> => {
    try {
      logger.info("=== Starting smartSeek function ===");

      const {videoId, query} = request.data;
      if (!videoId || !query) {
        throw new Error("Missing required parameters: videoId and query");
      }

      // Get video document
      const videoDoc = await admin.firestore().collection("videos").doc(videoId).get();
      if (!videoDoc.exists) {
        throw new Error("Video not found");
      }

      const videoData = videoDoc.data();
      if (!videoData?.transcriptionSegments || videoData.transcriptionStatus !== "completed") {
        throw new Error("Video transcription is not available");
      }

      // Lower the confidence threshold for better recall
      const CONFIDENCE_THRESHOLD = 0.3; // Lowered from 0.5 to 0.3

      // Process segments to find matches
      const segments = videoData.transcriptionSegments as TranscriptionSegment[];

      // Get embeddings for multiple variations of the query
      const openai = new OpenAI({apiKey: openaiApiKey.value()});

      // Create query variations for better matching
      const queryVariations = [
        query, // Original query
        `concept of ${query}`, // Conceptual variation
        `meaning of ${query}`, // Meaning variation
        `${query} explanation`, // Explanation variation
        `example of ${query}`, // Example variation
      ];

      const queryEmbedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: queryVariations,
      });

      // Get embeddings for each segment in batches
      const batchSize = 20;
      const results: SmartSeekResult[] = [];
      for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize);
        const segmentTexts = batch.map((s) => s.text);

        const segmentEmbeddings = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: segmentTexts,
        });

        // Calculate similarity scores using best matching query variation
        batch.forEach((segment, index) => {
          // Find best matching query variation
          const similarities = queryEmbedding.data.map((qEmbed) =>
            calculateCosineSimilarity(qEmbed.embedding, segmentEmbeddings.data[index].embedding)
          );
          const bestSimilarity = Math.max(...similarities);

          // Also check for substring matches
          const hasSubstringMatch = segment.text.toLowerCase().includes(query.toLowerCase());

          // Boost confidence if there's a direct substring match
          const finalConfidence = hasSubstringMatch ?
            Math.max(bestSimilarity, 0.7) : // Boost exact matches
            bestSimilarity;

          if (finalConfidence > CONFIDENCE_THRESHOLD) {
            results.push({
              timestamp: segment.start,
              confidence: finalConfidence,
              context: segment.text,
            });
          }
        });
      }

      // Sort by confidence and take top 8 (increased from 5)
      const topResults = results
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 8);

      logger.info("=== Successfully completed smartSeek function ===");
      return {results: topResults};
    } catch (error) {
      logger.error("Error in smartSeek:", error);
      throw error;
    }
  },
);

interface ChapterMarker {
  timestamp: number;
  title: string;
  summary: string;
}

interface GenerateChapterMarkersRequest {
  videoId: string;
}

export const generateChapterMarkers = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request: CallableRequest<GenerateChapterMarkersRequest>): Promise<{ chapters: ChapterMarker[] }> => {
    try {
      logger.info("=== Starting generateChapterMarkers function ===");

      const {videoId} = request.data;
      if (!videoId) {
        throw new Error("Missing required parameter: videoId");
      }

      // Get video document
      const videoDoc = await admin.firestore().collection("videos").doc(videoId).get();
      if (!videoDoc.exists) {
        throw new Error("Video not found");
      }

      const videoData = videoDoc.data();
      if (!videoData?.transcriptionSegments || videoData.transcriptionStatus !== "completed") {
        throw new Error("Video transcription is not available");
      }

      const segments = videoData.transcriptionSegments as TranscriptionSegment[];

      // Get the API key and verify it's not empty
      const apiKey = openaiApiKey.value();
      if (!apiKey) {
        throw new Error("OpenAI API key is not configured");
      }

      // Initialize OpenAI client
      const openai = new OpenAI({apiKey});

      // Analyze transcript to identify major topic changes
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing educational content and identifying logical chapter breaks. Create 4-6 chapters that help organize the content in a meaningful way.",
          },
          {
            role: "user",
            content: `Analyze this video transcript and identify major topic transitions. Create chapters with timestamps.
            
            Transcript:
            ${segments.map((s) => `[${s.start}] ${s.text}`).join("\n")}
            
            Return the chapters in this JSON format:
            {
              "chapters": [
                {
                  "timestamp": number,
                  "title": "string",
                  "summary": "string"
                }
              ]
            }`,
          },
        ],
        temperature: 0.7,
        response_format: {type: "json_object"},
      });

      const response = JSON.parse(completion.choices[0].message.content || "{}");
      const chapters = response.chapters as ChapterMarker[];

      if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
        throw new Error("Failed to generate valid chapter markers");
      }

      // Store chapters in Firestore
      await videoDoc.ref.update({
        chapterMarkers: chapters,
        chaptersGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("=== Successfully completed generateChapterMarkers function ===");
      return {chapters};
    } catch (error) {
      logger.error("Error in generateChapterMarkers:", error);
      throw error;
    }
  }
);

interface LearningPathNode {
  videoId: string;
  type: "core" | "practice" | "review" | "challenge";
  requiredConcepts: string[];
  estimatedDuration: number;
  difficulty: number;
  completed: boolean;
  score?: number;
  nextReviewDate?: Date;
}

interface LearningPath {
  userId: string;
  subjectId: string;
  nodes: LearningPathNode[];
  currentNodeIndex: number;
  lastUpdated: Date;
  completionRate: number;
  averageScore: number;
}

interface GenerateLearningPathRequest {
  userId: string;
  subjectId: string;
}

export const generateLearningPath = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request: CallableRequest<GenerateLearningPathRequest>): Promise<{ path: LearningPath }> => {
    try {
      logger.info("=== Starting generateLearningPath function ===");

      const {userId, subjectId} = request.data;
      if (!userId || !subjectId) {
        throw new Error("Missing required parameters: userId and subjectId");
      }

      // Get user's progress and preferences
      const userProgressDoc = await admin.firestore()
        .collection("users")
        .doc(userId)
        .collection("progress")
        .doc("learning")
        .get();

      const userProgress = userProgressDoc.data();
      if (!userProgress) {
        throw new Error("User progress not found");
      }

      // Get subject details and available videos
      const subjectDoc = await admin.firestore().collection("subjects").doc(subjectId).get();
      if (!subjectDoc.exists) {
        throw new Error("Subject not found");
      }

      const subject = subjectDoc.data();
      const videosSnapshot = await admin.firestore()
        .collection("videos")
        .where("subjectId", "==", subjectId)
        .get();

      const videos = videosSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Get the API key and verify it's not empty
      const apiKey = openaiApiKey.value();
      if (!apiKey) {
        throw new Error("OpenAI API key is not configured");
      }

      // Initialize OpenAI client
      const openai = new OpenAI({apiKey});

      // Generate personalized learning path
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert educational planner. Create a personalized learning path that adapts to the user's progress, preferences, and learning style.",
          },
          {
            role: "user",
            content: `Create a learning path for this subject using available videos.
            
            Subject: ${JSON.stringify(subject)}
            Available Videos: ${JSON.stringify(videos)}
            User Progress: ${JSON.stringify(userProgress)}
            
            Return the path in this JSON format:
            {
              "nodes": [
                {
                  "videoId": "string",
                  "type": "core" | "practice" | "review" | "challenge",
                  "requiredConcepts": ["string"],
                  "estimatedDuration": number,
                  "difficulty": number
                }
              ]
            }`,
          },
        ],
        temperature: 0.7,
        response_format: {type: "json_object"},
      });

      const response = JSON.parse(completion.choices[0].message.content || "{}");
      const nodes = response.nodes as Omit<LearningPathNode, "completed" | "score" | "nextReviewDate">[];

      if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
        throw new Error("Failed to generate valid learning path");
      }

      // Create learning path with initial state
      const path: LearningPath = {
        userId,
        subjectId,
        nodes: nodes.map((node) => ({
          ...node,
          completed: false,
        })),
        currentNodeIndex: 0,
        lastUpdated: new Date(),
        completionRate: 0,
        averageScore: 0,
      };

      // Store path in user's progress
      await userProgressDoc.ref.update({
        [`activeLearningPaths.${subjectId}`]: path,
      });

      logger.info("=== Successfully completed generateLearningPath function ===");
      return {path};
    } catch (error) {
      logger.error("Error in generateLearningPath:", error);
      throw error;
    }
  }
);

/**
 * Calculates the cosine similarity between two vectors.
 * @param {number[]} vec1 - The first vector
 * @param {number[]} vec2 - The second vector
 * @return {number} The cosine similarity between the vectors
 */
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((acc, val, i) => acc + val * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((acc, val) => acc + val * val, 0));
  const norm2 = Math.sqrt(vec2.reduce((acc, val) => acc + val * val, 0));
  return dotProduct / (norm1 * norm2);
}

export interface LearningStyleAnalysis {
  preferredContentTypes: string[];
  optimalDuration: number;
  challengeLevel: number;
  conceptConnections: string[];
  learningPace: "fast" | "medium" | "slow";
}

export interface KnowledgeGapAnalysis {
  weakConcepts: string[];
  misunderstoodRelationships: string[];
  recommendedPractice: string[];
  confidenceScores: { [conceptId: string]: number };
}

export const analyzeLearningStyle = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
  },
  async (request: CallableRequest<{ userId: string }>) => {
    try {
      logger.info("Starting learning style analysis for user:", request.data.userId);
      const {userId} = request.data;

      // Get user's learning history
      const userProgressRef = createRef.doc("users", userId, "progress", "learning");
      const progressDoc = await dbOperations.getDoc(userProgressRef);
      const userProgress = progressDoc.data() as UserProgress;

      // Get quiz attempts for pattern analysis
      const quizAttemptsRef = createRef.collection(`users/${userId}/quizAttempts`);
      const quizSnapshot = await dbOperations.getDocs(quizAttemptsRef);
      const quizAttempts = quizSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        score: doc.data().score || 0,
        completedAt: doc.data().completedAt?.toDate() || new Date(),
        wrongAnswers: doc.data().wrongAnswers || [],
      })) as QuizAttempt[];

      // Analyze video viewing patterns
      const videoInteractionsRef = createRef.collection(`users/${userId}/videoInteractions`);
      const videoSnapshot = await dbOperations.getDocs(videoInteractionsRef);
      const videoPatterns = videoSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        videoId: doc.data().videoId || "",
        timestamp: doc.data().timestamp?.toDate() || new Date(),
        duration: doc.data().duration || 0,
        replaySegments: doc.data().replaySegments || [],
      })) as VideoPlaybackPattern[];

      // Prepare comprehensive learning data
      const learningData = {
        quizPerformance: {
          attempts: quizAttempts,
          averageScore: calculateAverageScore(quizAttempts),
          timeDistribution: analyzeTimeDistribution(quizAttempts),
          errorPatterns: findErrorPatterns(quizAttempts),
        },
        videoEngagement: {
          patterns: videoPatterns,
          averageWatchTime: calculateAverageWatchTime(videoPatterns),
          preferredTimes: findPreferredStudyTimes(videoPatterns),
          replaySegments: analyzeReplayPatterns(videoPatterns),
        },
        conceptProgress: userProgress.conceptMastery,
        overallProgress: {
          completedVideos: Object.values(userProgress.subjects)
            .reduce((sum, subject) => sum + subject.completedVideos.length, 0),
          averageQuizScore: Object.values(userProgress.subjects)
            .reduce((sum, subject) => {
              const scores = Object.values(subject.quizScores);
              return scores.length ? sum + (scores.reduce((a, b) => a + b, 0) / scores.length) : sum;
            }, 0) / Object.keys(userProgress.subjects).length,
        },
      };

      // Initialize OpenAI
      const openai = new OpenAI({apiKey: openaiApiKey.value()});

      // Analyze learning patterns with GPT
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert in learning analytics and educational psychology. 
            Analyze learning patterns to identify optimal learning strategies.
            Focus on:
            1. Preferred content types based on engagement
            2. Optimal study duration based on performance
            3. Best performing time periods
            4. Learning pace and progression patterns
            5. Concept connection understanding`,
          },
          {
            role: "user",
            content: `Analyze this learning history and determine optimal learning parameters:
            ${JSON.stringify(learningData, null, 2)}
            
            Return a structured analysis following this format:
            {
              "preferredContentTypes": ["video", "interactive", "text", etc.],
              "optimalDuration": minutes (number),
              "challengeLevel": 0-100 (number),
              "conceptConnections": ["concept-ids"],
              "learningPace": "fast" | "medium" | "slow"
            }`,
          },
        ],
        temperature: 0.7,
        response_format: {type: "json_object"},
      });

      const analysis = JSON.parse(completion.choices[0].message.content || "{}");
      logger.info("Learning style analysis completed:", analysis);

      // Save analysis to user's profile
      await dbOperations.update(userProgressRef, {
        learningStyle: {
          ...analysis,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
      });

      return {analysis};
    } catch (error) {
      logger.error("Error in analyzeLearningStyle:", error);
      throw error;
    }
  }
);

export const analyzeKnowledgeGaps = onCall(
  {
    secrets: [openaiApiKey],
    region: "us-central1",
  },
  async (request: CallableRequest<{ userId: string; subjectId: string }>) => {
    try {
      const {userId, subjectId} = request.data;
      logger.info("Starting knowledge gap analysis:", {userId, subjectId});

      // Get subject and concept data
      const subjectDoc = await dbOperations.getDoc(createRef.doc("subjects", subjectId));
      const subject = subjectDoc.data();

      // Get all concepts for this subject
      const conceptsRef = createRef.collection("concepts");
      const conceptsQuery = createQuery.where(conceptsRef, "subjectId", "==", subjectId);
      const conceptsSnapshot = await dbOperations.getDocs(conceptsQuery);
      const concepts = conceptsSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Get user's quiz attempts and performance data
      const quizAttemptsRef = createRef.collection(`users/${userId}/quizAttempts`);
      const quizSnapshot = await dbOperations.getDocs(quizAttemptsRef);
      const quizAttempts = quizSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        ...doc.data(),
        timestamp: doc.data().completedAt?.toDate(),
      }));

      // Get user's progress
      const progressRef = createRef.doc("users", userId, "progress", "learning");
      const progressDoc = await dbOperations.getDoc(progressRef);
      const progress = progressDoc.data() as UserProgress;

      // Prepare comprehensive analysis data
      const analysisData = {
        subject,
        concepts,
        conceptRelationships: subject?.knowledgeGraph || {},
        userPerformance: {
          quizAttempts,
          conceptMastery: progress.conceptMastery,
          completedVideos: progress.subjects[subjectId]?.completedVideos || [],
          reflections: progress.subjects[subjectId]?.reflections || [],
        },
      };

      // Initialize OpenAI
      const openai = new OpenAI({apiKey: openaiApiKey.value()});

      // Analyze knowledge gaps with GPT
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert in educational assessment and knowledge mapping.
            Analyze learning patterns to identify:
            1. Knowledge gaps and weak areas
            2. Misconceptions and error patterns
            3. Missing prerequisite knowledge
            4. Recommended focus areas
            5. Confidence levels in different concepts`,
          },
          {
            role: "user",
            content: `Analyze this learning data to identify knowledge gaps and learning needs:
            ${JSON.stringify(analysisData, null, 2)}
            
            Return a structured analysis following this format:
            {
              "weakConcepts": ["concept-ids"],
              "misunderstoodRelationships": ["relationship-descriptions"],
              "recommendedPractice": ["practice-suggestions"],
              "confidenceScores": {
                "concept-id": confidence-score (0-100)
              }
            }`,
          },
        ],
        temperature: 0.7,
        response_format: {type: "json_object"},
      });

      const analysis = JSON.parse(completion.choices[0].message.content || "{}");
      logger.info("Knowledge gap analysis completed:", analysis);

      // Save analysis results
      await dbOperations.update(progressRef, {
        [`subjects.${subjectId}.gapAnalysis`]: {
          ...analysis,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
      });

      return {analysis};
    } catch (error) {
      logger.error("Error in analyzeKnowledgeGaps:", error);
      throw error;
    }
  }
);

/**
 * Calculate average score from quiz attempts
 * @param {QuizAttempt[]} attempts - Array of quiz attempts to analyze
 * @return {number} The average score across all attempts
 */
function calculateAverageScore(attempts: QuizAttempt[]): number {
  return attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length;
}

interface TimeDistribution {
  [hour: number]: number;
}

interface ReplayDistribution {
  [videoId: string]: number;
}

/**
 * Analyze time distribution of quiz attempts
 * @param {QuizAttempt[]} attempts - Array of quiz attempts to analyze
 * @return {TimeDistribution} Distribution of attempts by hour
 */
function analyzeTimeDistribution(attempts: QuizAttempt[]): TimeDistribution {
  return attempts.reduce((distribution: TimeDistribution, attempt) => {
    const hour = new Date(attempt.completedAt).getHours();
    return {
      ...distribution,
      [hour]: (distribution[hour] || 0) + 1,
    };
  }, {});
}

/**
 * Find error patterns in quiz attempts
 * @param {QuizAttempt[]} attempts - Array of quiz attempts to analyze
 * @return {string[]} Array of identified error patterns
 */
function findErrorPatterns(attempts: QuizAttempt[]): string[] {
  return attempts.reduce((patterns, attempt) => {
    if (attempt.wrongAnswers?.length) {
      patterns.push(...attempt.wrongAnswers);
    }
    return patterns;
  }, [] as string[]);
}

/**
 * Calculate average watch time from video patterns
 * @param {VideoPlaybackPattern[]} patterns - Array of video playback patterns
 * @return {number} Average watch time in seconds
 */
function calculateAverageWatchTime(patterns: VideoPlaybackPattern[]): number {
  return patterns.reduce((sum, pattern) => sum + pattern.duration, 0) / patterns.length;
}

/**
 * Find preferred study times from video patterns
 * @param {VideoPlaybackPattern[]} patterns - Array of video playback patterns
 * @return {string[]} Array of preferred study hours
 */
function findPreferredStudyTimes(patterns: VideoPlaybackPattern[]): string[] {
  return patterns.reduce((times, pattern) => {
    const hour = new Date(pattern.timestamp).getHours();
    return times.includes(hour.toString()) ? times : [...times, hour.toString()];
  }, [] as string[]);
}

/**
 * Analyze video replay patterns
 * @param {VideoPlaybackPattern[]} patterns - Array of video playback patterns
 * @return {ReplayDistribution} Distribution of replays by video ID
 */
function analyzeReplayPatterns(patterns: VideoPlaybackPattern[]): ReplayDistribution {
  return patterns.reduce((replays: ReplayDistribution, pattern) => {
    return {
      ...replays,
      [pattern.videoId]: (replays[pattern.videoId] || 0) + 1,
    };
  }, {});
}

interface QuizAttempt {
  score: number;
  completedAt: Date;
  wrongAnswers?: string[];
}

interface VideoPlaybackPattern {
  videoId: string;
  timestamp: Date;
  duration: number;
  replaySegments?: string[];
}
