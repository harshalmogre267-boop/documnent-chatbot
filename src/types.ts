export type FileType = 'pdf' | 'docx' | 'txt';

export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: FileType;
  status: 'parsing' | 'indexed' | 'error';
  error?: string;
  chunksCount: number;
}

export interface DocumentChunk {
  id: string;
  fileId: string;
  fileName: string;
  text: string;
  pageNumber?: number; // PDFs only
}

export interface Citation {
  chunkId: string;
  fileName: string;
  pageNumber?: number;
  text: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string; // ISO string for serialization
  citations?: Citation[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  fileIds: string[]; // Files uploaded in this session
  chatMode?: 'documents' | 'general';
  createdAt: string;
}

export interface AppSettings {
  geminiApiKey: string;
  localSearchOnly: boolean;
}
