import { GoogleGenerativeAI } from '@google/generative-ai';
import type { DocumentChunk, Message, Citation } from '../types';

// Validate the API key by running a small test generation
export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.trim().length === 0) return false;
  const cleanApiKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '');
  const genAI = new GoogleGenerativeAI(cleanApiKey);
  const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
  
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 5 }
      });
      if (result.response.text()) {
        return true;
      }
    } catch (error) {
      console.warn(`Validation failed for model ${modelName}:`, error);
    }
  }
  return false;
}

// Generate answer using Google Gemini API
export async function generateAnswerWithGemini(
  query: string,
  chunks: DocumentChunk[],
  chatHistory: Message[],
  apiKey: string,
  mode: 'documents' | 'general',
  selectedModel: string
): Promise<{ text: string; citations: Citation[] }> {
  const cleanApiKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '');
  const genAI = new GoogleGenerativeAI(cleanApiKey);
  
  // Define system instruction depending on active chat mode
  const systemInstruction = mode === 'documents' && chunks.length > 0
    ? `You are an expert AI assistant that answers questions based ONLY on the provided document context.
Your goal is to answer the user's question accurately using the document text.

Follow these rules strictly:
1. Base your answer strictly on the provided context sections. Do not make assumptions or bring in outside general knowledge.
2. If the context does not contain the answer, reply: "I cannot find the answer in the uploaded documents."
3. Keep your response concise, professional, and directly relevant.
4. Format your response using clear markdown (e.g., bullet points, bolding, tables, code blocks).
5. Ground your answers by adding inline citations at the end of the sentences or facts they reference. Format inline citations strictly as [1], [2], etc., corresponding to the Context Section numbers (e.g. use [1] for [Context Section 1], [2] for [Context Section 2], etc.). Do not use the file name as the citation, only the bracketed numbers.
6. The user query may be a follow-up. Answer the query considering the conversation history.`
    : `You are Document Chatbot, a helpful, friendly, and intelligent AI assistant (like ChatGPT).
Assist the user with their queries, explain concepts clearly, write code if requested, and format your output using rich markdown (bolding, lists, code blocks, tables).
Answer the user's question directly, accurately, and conversationally.
The user query may be a follow-up. Keep the conversation history in mind.`;

  // Construct context string from retrieved chunks (only if in documents mode)
  let contextString = '';
  if (mode === 'documents' && chunks.length > 0) {
    contextString = chunks.map((chunk, idx) => {
      const pageInfo = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';
      return `[Context Section ${idx + 1}]
Source File: ${chunk.fileName}${pageInfo}
Text:
${chunk.text}
----------------------`;
    }).join('\n\n');
  }

  // Convert the last 6 messages to Gemini content format to maintain memory
  const contents = chatHistory.slice(-6).map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  // Append user prompt with context if in documents mode
  const userPrompt = mode === 'documents' && chunks.length > 0
    ? `DOCUMENT CONTEXT:
${contextString}

USER QUESTION:
${query}`
    : query;

  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }]
  });

  const models = [selectedModel, 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  const uniqueModels = Array.from(new Set(models));
  let firstModelError: any = null;

  for (let i = 0; i < uniqueModels.length; i++) {
    const modelName = uniqueModels[i];
    try {
      console.log(`Attempting generation with model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction
      });

      const result = await model.generateContent({
        contents,
        generationConfig: {
          temperature: mode === 'documents' ? 0.1 : 0.7, // Higher temp for conversational mode
          maxOutputTokens: 1000,
        }
      });

      const responseText = result.response.text();

      // Convert chunks to citations only for documents mode
      const citations = mode === 'documents' ? chunks.map(chunk => ({
        chunkId: chunk.id,
        fileName: chunk.fileName,
        pageNumber: chunk.pageNumber,
        text: chunk.text
      })) : [];

      return {
        text: responseText,
        citations
      };
    } catch (err: any) {
      console.warn(`Generation failed with model ${modelName}:`, err.message || err);
      if (i === 0) {
        firstModelError = err; // Store the primary model's error
      }
    }
  }

  // If all fallback models failed, throw the primary model's error to show the real rate/quota limit.
  throw firstModelError || new Error('All Gemini models failed to generate content.');
}

// Local extractive Q&A search (Fallback when no API Key is set)
export function generateLocalExtractiveAnswer(
  query: string,
  chunks: DocumentChunk[]
): { text: string; citations: Citation[] } {
  if (chunks.length === 0) {
    return {
      text: "No document context is available. Please upload some files or try the demo document.",
      citations: []
    };
  }

  // Clean and tokenize search terms (longer than 2 characters)
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2);

  interface ScoredSentence {
    text: string;
    score: number;
    chunk: DocumentChunk;
  }

  const scoredSentences: ScoredSentence[] = [];

  for (const chunk of chunks) {
    // Regex split by standard sentence punctuation
    const sentences = chunk.text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [chunk.text];
    for (const rawSent of sentences) {
      const sentenceText = rawSent.trim();
      if (sentenceText.length < 15) continue; // Skip short fragments

      let score = 0;
      const lowerSent = sentenceText.toLowerCase();

      // Count term overlap
      for (const term of queryTerms) {
        if (lowerSent.includes(term)) {
          score += 1.5;
        }
      }

      // Bonus for exact subphrase match of the query
      const trimmedQuery = query.toLowerCase().trim();
      if (trimmedQuery.length > 3 && lowerSent.includes(trimmedQuery)) {
        score += 6.0;
      }

      if (score > 0) {
        scoredSentences.push({
          text: sentenceText,
          score,
          chunk
        });
      }
    }
  }

  // Sort sentences by relevance score descending
  scoredSentences.sort((a, b) => b.score - a.score);

  let responseText = '';
  const selectedCitations: Citation[] = [];

  if (scoredSentences.length === 0) {
    // If no specific sentence overlaps, return the highest scoring chunk
    const topChunk = chunks[0];
    responseText = `I couldn't find a direct matching sentence, but here is the most relevant snippet from the document:\n\n> "${topChunk.text}" [1]`;
    selectedCitations.push({
      chunkId: topChunk.id,
      fileName: topChunk.fileName,
      pageNumber: topChunk.pageNumber,
      text: topChunk.text
    });
  } else {
    // Take up to 3 best sentences and aggregate them
    const topSentences = scoredSentences.slice(0, 3);
    responseText = `**Local Search Results (Extracted Sentences):**\n\n`;
    
    topSentences.forEach((s) => {
      // Find or add chunk to citations list
      let citIdx = selectedCitations.findIndex(c => c.chunkId === s.chunk.id);
      if (citIdx === -1) {
        selectedCitations.push({
          chunkId: s.chunk.id,
          fileName: s.chunk.fileName,
          pageNumber: s.chunk.pageNumber,
          text: s.chunk.text
        });
        citIdx = selectedCitations.length - 1;
      }
      const pageInfo = s.chunk.pageNumber ? ` (Page ${s.chunk.pageNumber})` : '';
      responseText += `* "... ${s.text} ..." [${citIdx + 1}] (*from ${s.chunk.fileName}${pageInfo}*)\n`;
    });

    responseText += `\n\n*(Note: To synthesize these snippets into a natural, conversational answer, please enter your Gemini API Key in the sidebar.)*`;
  }

  return {
    text: responseText,
    citations: selectedCitations
  };
}
