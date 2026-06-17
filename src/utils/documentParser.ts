import type { DocumentChunk } from '../types';

// Helper to split text into sentences
function splitIntoSentences(text: string): string[] {
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  // Match sentences ending with ., ! or ? followed by space or end-of-string
  const sentenceRegex = /[^.!?]+[.!?]+(?:\s|$)/g;
  const matches = cleanedText.match(sentenceRegex);
  if (!matches) {
    return cleanedText.length > 0 ? [cleanedText] : [];
  }
  return matches.map(s => s.trim());
}

// Chunks a block of text into segments of roughly targetSize characters with overlap
export function chunkTextContent(
  text: string,
  fileId: string,
  fileName: string,
  pageNumber?: number
): DocumentChunk[] {
  const sentences = splitIntoSentences(text);
  const chunks: DocumentChunk[] = [];
  
  const targetSize = 800;    // Characters target per chunk
  const overlapSize = 200;   // Characters overlap between consecutive chunks
  
  let currentChunkText = '';
  let sentenceQueue: string[] = [];
  
  for (const sentence of sentences) {
    // If adding this sentence exceeds target size, save current chunk
    if (currentChunkText.length + sentence.length > targetSize && currentChunkText.length > 0) {
      chunks.push({
        id: `${fileId}-chunk-${chunks.length}`,
        fileId,
        fileName,
        text: currentChunkText.trim(),
        pageNumber,
      });
      
      // Compute overlap queue
      let overlapText = '';
      const newQueue: string[] = [];
      // Work backwards to collect sentences for overlap
      for (let i = sentenceQueue.length - 1; i >= 0; i--) {
        const s = sentenceQueue[i];
        if (overlapText.length + s.length <= overlapSize) {
          overlapText = s + ' ' + overlapText;
          newQueue.unshift(s);
        } else {
          break;
        }
      }
      currentChunkText = overlapText;
      sentenceQueue = newQueue;
    }
    
    currentChunkText += (currentChunkText.length > 0 ? ' ' : '') + sentence;
    sentenceQueue.push(sentence);
  }
  
  // Save trailing text
  if (currentChunkText.trim().length > 0) {
    chunks.push({
      id: `${fileId}-chunk-${chunks.length}`,
      fileId,
      fileName,
      text: currentChunkText.trim(),
      pageNumber,
    });
  }
  
  return chunks;
}

// Parse PDF file using globally loaded PDF.js
async function parsePdf(file: File, fileId: string): Promise<DocumentChunk[]> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF.js is still loading. Please wait a few seconds and try again.');
  }

  // Set the worker URL dynamically
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let allChunks: DocumentChunk[] = [];
  let totalExtractedLength = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      totalExtractedLength += pageText.trim().length;

      if (pageText.trim().length > 0) {
        // Chunk this page individually to keep precise page number references
        const pageChunks = chunkTextContent(pageText, fileId, file.name, pageNum);
        allChunks = [...allChunks, ...pageChunks];
      }
    } catch (pageErr) {
      console.error(`Error parsing page ${pageNum} of ${file.name}:`, pageErr);
    }
  }

  if (totalExtractedLength === 0) {
    throw new Error('This PDF file contains no readable text. It might be scanned or image-only.');
  }

  return allChunks;
}

// Parse DOCX file using globally loaded Mammoth.js
async function parseDocx(file: File, fileId: string): Promise<DocumentChunk[]> {
  const mammoth = (window as any).mammoth;
  if (!mammoth) {
    throw new Error('Mammoth.js is still loading. Please wait a few seconds and try again.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;

  if (!text || text.trim().length === 0) {
    throw new Error('This Word document contains no readable text.');
  }

  // Chunk the full text
  return chunkTextContent(text, fileId, file.name);
}

// Parse plain text file
async function parseTxt(file: File, fileId: string): Promise<DocumentChunk[]> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read the text file.'));
    reader.readAsText(file);
  });

  if (text.trim().length === 0) {
    throw new Error('This text file is empty.');
  }

  return chunkTextContent(text, fileId, file.name);
}

// Main parser router
export async function parseDocument(file: File, fileId: string): Promise<DocumentChunk[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'pdf') {
    return parsePdf(file, fileId);
  } else if (extension === 'docx') {
    return parseDocx(file, fileId);
  } else if (extension === 'txt') {
    return parseTxt(file, fileId);
  } else {
    throw new Error(`Unsupported file type: .${extension}. Please upload PDF, DOCX, or TXT files.`);
  }
}
