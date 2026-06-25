# Project Overview: ai-chatbot-for-document

## Project Metadata

- Name: `ai-chatbot-for-document`
- Version: `0.0.0`
- Private package: `true`
- TypeScript project using `type: module`
- Primary dependencies:
  - `react` `^19.2.6`
  - `react-dom` `^19.2.6`
  - `@google/generative-ai` `^0.24.1`
  - `lucide-react` `^1.17.0`
- Dev dependencies:
  - `vite` `^8.0.12`
  - `typescript` `~6.0.2`
  - `eslint` `^10.3.0`
  - `@vitejs/plugin-react` `^6.0.1`
  - `@types/react`, `@types/react-dom`, `@types/node`

## Purpose

This application is a browser-based document chatbot that lets users upload documents and ask questions about their content. It combines local document ingest, semantic retrieval, and Google Gemini generation to create a document-aware conversational experience.

## Core Features

- Upload PDF, DOCX, and TXT documents via drag-and-drop or file selection.
- Parse and chunk uploaded documents into searchable segments.
- Build an in-browser search engine using TF-IDF ranking over document chunks.
- Support Google Gemini-based answer generation with inline document grounding.
- Provide a local extractive fallback answer mode when no API key is available.
- Save sessions, uploaded files, and settings in `localStorage`.
- Manage chat sessions and include/exclude files per session.
- View source citations and raw document segments via a source inspector.
- Demo content loader for quick evaluation without uploading files.
- Select a Gemini model and tune retrieval limit for RAG.

## Usage Scripts

- `npm run dev` — start Vite development server
- `npm run build` — compile TypeScript and build the app with Vite
- `npm run lint` — run ESLint across the workspace
- `npm run preview` — preview a production build locally

## App Architecture

### Entry Point

- `src/main.tsx`
  - Renders React app into `#root`
  - Uses `React.StrictMode`

### Main App

- `src/App.tsx`
  - Manages app state: uploaded files, chunks, chat sessions, API key, selected model, RAG limit, active citation
  - Persists state in `localStorage`
  - Handles file upload, parsing, demo load, session creation, deletion, and message sending
  - Uses `SearchEngine` to retrieve relevant document chunks
  - Uses `generateAnswerWithGemini` to call Gemini when an API key is valid
  - Uses `generateLocalExtractiveAnswer` for fallback local search answers
  - Renders `Sidebar`, `ChatArea`, and `SourceViewer`

### UI Components

- `src/components/Sidebar.tsx`
  - Upload area with drag-and-drop and file picker
  - Document list with upload status and session inclusion toggles
  - Session list with new session, rename, and delete actions
  - API key input and validation status
  - Model selection and RAG result limit slider
  - Reset app action

- `src/components/ChatArea.tsx`
  - Conversation display and user input area
  - Supports rich message formatting, inline citations, code blocks, lists, and quotes
  - Scrolls automatically and resizes textarea input
  - Provides button action for demo load and message send

- `src/components/SourceViewer.tsx`
  - Shows selected citation metadata and raw chunk text
  - Allows copy-to-clipboard of the source text

### Utility Modules

- `src/utils/documentParser.ts`
  - Parses supported file types separately:
    - PDF via globally loaded `pdfjsLib`
    - DOCX via globally loaded `mammoth`
    - Plain text via `FileReader`
  - Splits text into chunks of roughly 800 characters with 200-character overlap
  - Preserves PDF page numbers for citations

- `src/utils/searchEngine.ts`
  - Implements a browser-side search engine using TF-IDF
  - Tokenizes text, filters stop words, computes term frequency and document frequency
  - Ranks chunks by TF-IDF score with phrase and filename bonus

- `src/utils/geminiService.ts`
  - Validates Gemini API keys by attempting a small generation
  - Builds system instructions for document-grounded or general assistant behavior
  - Sends context and chat history to Google Gemini models
  - Provides fallback local extractive answer generation if no API key exists

### Type Definitions

- `src/types.ts`
  - `DocumentFile`, `DocumentChunk`, `Citation`, `Message`, `ChatSession`, `AppSettings`
  - Defines core data structures for file metadata, query results, and session data

## Configuration Files

- `vite.config.ts`
  - Uses `@vitejs/plugin-react`
  - Default Vite configuration for React app

- `tsconfig.json`
  - Project references to `tsconfig.app.json` and `tsconfig.node.json`

- `tsconfig.app.json`
  - Compiler options targeting `es2023`, `DOM`, `react-jsx`
  - Includes `src`

- `tsconfig.node.json`
  - Compiler options targeting `es2023`, `node`
  - Includes `vite.config.ts`

- `eslint.config.js`
  - Base ESLint configuration with `@eslint/js` and recommended TypeScript linting options

## Files and Folder Layout

- `index.html`
- `package.json`
- `README.md`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `eslint.config.js`
- `src/`
  - `App.tsx`
  - `main.tsx`
  - `types.ts`
  - `components/`
    - `ChatArea.tsx`
    - `Sidebar.tsx`
    - `SourceViewer.tsx`
  - `utils/`
    - `documentParser.ts`
    - `searchEngine.ts`
    - `geminiService.ts`
  - `assets/`
  - `App.css`
  - `index.css`

## How the App Works

1. On load, the app restores saved state from `localStorage`.
2. Users can upload supported documents or load the demo guide.
3. Uploaded files are parsed and chunked into searchable text segments.
4. A chat session is created or reused for the current conversation.
5. When the user asks a question, relevant chunks are retrieved using the `SearchEngine`.
6. If a valid Google Gemini API key is configured, the app sends the query and document context to Gemini.
7. If no API key is present, the app falls back to a local extractive answer using the best matching sentences.
8. Answers may include inline citations and can be inspected in the source viewer.

## Notes

- The app expects global JS libraries for PDF and DOCX parsing in the browser environment.
- The Gemini integration is based on `@google/generative-ai` and requires a Google API key.
- Local persistence is implemented via `localStorage`, so data stays on the same browser unless cleared.

## Quick Start

1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Open the app in the browser and upload documents or use the demo.
4. Paste a Google Gemini API key into the sidebar to enable document-grounded generation.

---

Generated summary file for the current workspace.
