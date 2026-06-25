import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SourceViewer } from './components/SourceViewer';
import type { DocumentFile, DocumentChunk, ChatSession, Message, Citation } from './types';
import { parseDocument } from './utils/documentParser';
import { SearchEngine } from './utils/searchEngine';
import { validateApiKey, generateAnswerWithGemini, generateLocalExtractiveAnswer } from './utils/geminiService';

const DEMO_FILE_NAME = 'ai_briefing_guide.txt';
const DEMO_FILE_CONTENT = `Document Chatbot Demonstration Guide: Artificial Intelligence & Machine Learning

1. What is Artificial Intelligence (AI)?
Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think like humans and mimic their actions. The term may also be applied to any machine that exhibits traits associated with a human mind such as learning and problem-solving. AI enables software to perform tasks like reasoning, planning, and recognizing speech or visual patterns.

2. Understanding Machine Learning (ML)
Machine Learning is a subset of artificial intelligence. It focuses on the teaching of computers to learn from data and improve with experience - without being explicitly programmed. In machine learning, algorithms are trained to find patterns and features in large amounts of data in order to make decisions and predictions based on new data. The process begins with observations or data, such as examples, direct experience, or instruction, in order to look for patterns.

3. Deep Learning vs Machine Learning
Deep Learning is a specialized subfield of Machine Learning. It is based on artificial neural networks, which are inspired by the structure and function of the human brain. While classical machine learning algorithms require human experts to manually select and extract features from raw data, deep learning neural networks can automatically learn representation and features directly from the data. However, deep learning requires massive amounts of training data and high performance computing power (like GPUs) to run.

4. Natural Language Processing (NLP)
Natural Language Processing is a branch of AI that helps computers understand, interpret, and manipulate human language. NLP draws from many disciplines, including computer science and computational linguistics, to fill the gap between human communication and computer understanding. Applications of NLP include translation services, voice assistants, sentiment analysis, and conversational chatbots.

5. Retrieval-Augmented Generation (RAG)
Retrieval-Augmented Generation (RAG) is a technique that optimizes the output of a large language model. It does this by querying an authoritative knowledge base (like uploaded documents) outside of its training data sources before generating a response. This process ensures that the AI's answer is grounded in specific, trusted, and up-to-date facts, preventing hallucinations and ensuring source-verifiability. This chatbot application utilizes RAG to search your documents and synthesize answers based on retrieved context.`;

export default function App() {
  // --- Global States ---
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean>(false);
  const [isValidatingApiKey, setIsValidatingApiKey] = useState<boolean>(false);
  
  const [isLoadingAnswer, setIsLoadingAnswer] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  // --- Advanced Settings States ---
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [ragLimit, setRagLimit] = useState<number>(4);

  // --- Search Engine Reference ---
  const searchEngineRef = useRef<SearchEngine | null>(null);

  // --- Initial Load from LocalStorage ---
  useEffect(() => {
    const savedKey = localStorage.getItem('docuchat_api_key') || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
    const savedSessions = localStorage.getItem('docuchat_sessions');
    const savedFiles = localStorage.getItem('docuchat_files');
    const savedChunks = localStorage.getItem('docuchat_chunks');
    const savedModel = localStorage.getItem('docuchat_model') || 'gemini-2.5-flash';
    const savedRagLimit = localStorage.getItem('docuchat_rag_limit');

    setApiKey(savedKey);
    setSelectedModel(savedModel);
    if (savedRagLimit) {
      setRagLimit(parseInt(savedRagLimit, 10));
    }

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to restore sessions:', e);
      }
    }

    if (savedFiles && savedChunks) {
      try {
        const parsedFiles = JSON.parse(savedFiles);
        const parsedChunks = JSON.parse(savedChunks);
        setFiles(parsedFiles);
        setChunks(parsedChunks);
        searchEngineRef.current = new SearchEngine(parsedChunks);
      } catch (e) {
        console.error('Failed to restore files/chunks:', e);
      }
    }
  }, []);

  // --- Sync Model & RAG Limit with LocalStorage ---
  useEffect(() => {
    localStorage.setItem('docuchat_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('docuchat_rag_limit', ragLimit.toString());
  }, [ragLimit]);

  // --- Update Search Engine when Chunks Change ---
  useEffect(() => {
    searchEngineRef.current = new SearchEngine(chunks);
  }, [chunks]);

  // --- Debounced API Key Validation ---
  useEffect(() => {
    if (!apiKey) {
      setIsApiKeyValid(false);
      localStorage.removeItem('docuchat_api_key');
      return;
    }

    setIsValidatingApiKey(true);
    const delayDebounce = setTimeout(async () => {
      const isValid = await validateApiKey(apiKey);
      setIsApiKeyValid(isValid);
      setIsValidatingApiKey(false);
      if (isValid) {
        localStorage.setItem('docuchat_api_key', apiKey);
      }
    }, 1000);

    return () => clearTimeout(delayDebounce);
  }, [apiKey]);

  // --- Sync Sessions with LocalStorage ---
  const saveSessions = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
    try {
      localStorage.setItem('docuchat_sessions', JSON.stringify(updatedSessions));
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }
  };

  // --- Sync Files/Chunks with LocalStorage ---
  const saveFilesAndChunks = (updatedFiles: DocumentFile[], updatedChunks: DocumentChunk[]) => {
    setFiles(updatedFiles);
    setChunks(updatedChunks);
    try {
      localStorage.setItem('docuchat_files', JSON.stringify(updatedFiles));
      localStorage.setItem('docuchat_chunks', JSON.stringify(updatedChunks));
    } catch (e) {
      console.warn('LocalStorage limit exceeded. Reverting chunk persistence but keeping files in memory.', e);
      // Fallback: Still save files metadata, chunks stay in React state
      localStorage.setItem('docuchat_files', JSON.stringify(updatedFiles));
      localStorage.removeItem('docuchat_chunks');
    }
  };

  // --- Handlers: Session Management ---
  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Chat',
      messages: [],
      fileIds: files.map(f => f.id),
      createdAt: new Date().toISOString()
    };
    saveSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setActiveCitation(null);
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    setActiveCitation(null);
  };

  const handleDeleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    saveSessions(updated);
    if (currentSessionId === id) {
      setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
      setActiveCitation(null);
    }
  };

  // --- Handlers: Session Specific Files & Settings ---
  const handleToggleFileInSession = (fileId: string) => {
    if (!currentSessionId) return;
    const updatedSessions = sessions.map(s => {
      if (s.id !== currentSessionId) return s;
      const fileIds = s.fileIds || [];
      const exists = fileIds.includes(fileId);
      const newFileIds = exists 
        ? fileIds.filter(id => id !== fileId)
        : [...fileIds, fileId];
      return { ...s, fileIds: newFileIds };
    });
    saveSessions(updatedSessions);
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    const updated = sessions.map(s => 
      s.id === id ? { ...s, title: newTitle } : s
    );
    saveSessions(updated);
  };

  const handleResetApp = () => {
    if (window.confirm("Are you sure you want to clear all data? This will delete all chat sessions, uploaded documents, and custom settings.")) {
      localStorage.clear();
      setFiles([]);
      setChunks([]);
      setSessions([]);
      setCurrentSessionId(null);
      setApiKey('');
      setIsApiKeyValid(false);
      setActiveCitation(null);
      setSelectedModel('gemini-2.5-flash');
      setRagLimit(4);
      searchEngineRef.current = null;
      window.location.reload();
    }
  };

  // --- Handlers: File Processing ---
  const handleUpload = async (fileList: FileList) => {
    const newFiles: DocumentFile[] = [];
    const newChunks: DocumentChunk[] = [];
    
    // Prepare session if none exists
    let activeId = currentSessionId;
    let currentSession = sessions.find(s => s.id === activeId);
    
    if (!currentSession) {
      const newSession: ChatSession = {
        id: `session-${Date.now()}`,
        title: 'New Chat',
        messages: [],
        fileIds: [],
        createdAt: new Date().toISOString()
      };
      activeId = newSession.id;
      currentSession = newSession;
      saveSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
    }

    // Process files sequentially
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = `file-${Date.now()}-${i}`;
      
      const fileMeta: DocumentFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.name.split('.').pop()?.toLowerCase() as any || 'txt',
        status: 'parsing',
        chunksCount: 0
      };

      // Set parsing state immediately
      setFiles(prev => [...prev, fileMeta]);

      try {
        const parsedChunks = await parseDocument(file, fileId);
        
        // Update parsing success
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'indexed', chunksCount: parsedChunks.length } 
            : f
        ));
        
        newFiles.push({ ...fileMeta, status: 'indexed', chunksCount: parsedChunks.length });
        newChunks.push(...parsedChunks);
      } catch (err: any) {
        console.error('Error parsing file:', file.name, err);
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'error', error: err.message || 'Unknown parsing error' } 
            : f
        ));
      }
    }

    if (newChunks.length > 0) {
      const updatedFiles = [...files.filter(f => f.status !== 'parsing'), ...newFiles];
      const updatedChunks = [...chunks, ...newChunks];
      
      // Update session's document tracking
      const updatedSessions = sessions.map(s => 
        s.id === activeId 
          ? { ...s, fileIds: [...s.fileIds, ...newFiles.map(f => f.id)] } 
          : s
      );

      saveSessions(updatedSessions);
      saveFilesAndChunks(updatedFiles, updatedChunks);
    }
  };

  const handleDeleteFile = (id: string) => {
    const updatedFiles = files.filter(f => f.id !== id);
    const updatedChunks = chunks.filter(c => c.fileId !== id);
    saveFilesAndChunks(updatedFiles, updatedChunks);
  };

  // --- Handlers: Load Demo Guide ---
  const handleLoadDemo = () => {
    const demoId = `file-demo-${Date.now()}`;
    const demoFileMeta: DocumentFile = {
      id: demoId,
      name: DEMO_FILE_NAME,
      size: DEMO_FILE_CONTENT.length,
      type: 'txt',
      status: 'indexed',
      chunksCount: 0
    };

    // Split paragraphs into chunks
    const sentences = DEMO_FILE_CONTENT.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(?:\s|$)/g) || [DEMO_FILE_CONTENT];
    const demoChunks: DocumentChunk[] = [];
    let currentChunk = '';
    
    sentences.forEach((sentence) => {
      if (currentChunk.length + sentence.length > 600 && currentChunk.length > 0) {
        demoChunks.push({
          id: `${demoId}-chunk-${demoChunks.length}`,
          fileId: demoId,
          fileName: DEMO_FILE_NAME,
          text: currentChunk.trim()
        });
        currentChunk = '';
      }
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
    });

    if (currentChunk.trim().length > 0) {
      demoChunks.push({
        id: `${demoId}-chunk-${demoChunks.length}`,
        fileId: demoId,
        fileName: DEMO_FILE_NAME,
        text: currentChunk.trim()
      });
    }

    demoFileMeta.chunksCount = demoChunks.length;

    // Create session if none
    let activeId = currentSessionId;
    let currentSession = sessions.find(s => s.id === activeId);
    
    if (!currentSession) {
      const newSession: ChatSession = {
        id: `session-${Date.now()}`,
        title: 'Demo Session',
        messages: [],
        fileIds: [demoId],
        createdAt: new Date().toISOString()
      };
      activeId = newSession.id;
      currentSession = newSession;
      saveSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
    } else {
      // Add demo to active session
      const updatedSessions = sessions.map(s => 
        s.id === activeId 
          ? { ...s, title: s.title === 'New Chat' ? 'Demo Session' : s.title, fileIds: [...s.fileIds, demoId] } 
          : s
      );
      saveSessions(updatedSessions);
    }

    saveFilesAndChunks([...files, demoFileMeta], [...chunks, ...demoChunks]);
  };

  // --- Handlers: Chat Mode Toggling ---
  const handleChatModeChange = (mode: 'documents' | 'general') => {
    if (!currentSessionId) return;
    const updatedSessions = sessions.map(s => 
      s.id === currentSessionId ? { ...s, chatMode: mode } : s
    );
    saveSessions(updatedSessions);
  };

  // --- Handlers: RAG Message Sending ---
  const handleSendMessage = async (text: string) => {
    if (!currentSessionId) return;

    const activeSession = sessions.find(s => s.id === currentSessionId);
    if (!activeSession) return;

    // Resolve mode: default to general if no files are uploaded
    const currentMode = activeSession.chatMode || (files.length > 0 ? 'documents' : 'general');

    const userMessage: Message = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString()
    };

    // 1. Add user message immediately to the session
    const updatedMessages = [...activeSession.messages, userMessage];
    
    // Auto title generation if first message
    let newTitle = activeSession.title;
    if (activeSession.messages.length === 0) {
      newTitle = text.length > 35 ? `${text.substring(0, 35).trim()}...` : text;
    }

    const updatedSession: ChatSession = {
      ...activeSession,
      title: newTitle,
      messages: updatedMessages,
      chatMode: currentMode
    };

    const newSessions = sessions.map(s => s.id === currentSessionId ? updatedSession : s);
    saveSessions(newSessions);
    setIsLoadingAnswer(true);

    try {
      // 2. Perform local search engine retrieval (only in document mode)
      let retrievedChunks: DocumentChunk[] = [];
      if (currentMode === 'documents') {
        const activeFileIds = activeSession.fileIds || [];
        const sessionChunks = chunks.filter(c => activeFileIds.includes(c.fileId));
        if (sessionChunks.length > 0) {
          const sessionSearchEngine = new SearchEngine(sessionChunks);
          retrievedChunks = sessionSearchEngine.search(text, ragLimit);
        }
      }

      // 3. Generate answer depending on Mode (Gemini or Local Extractive / Fallback)
      let answerText = '';
      let citations: Citation[] = [];

      if (isApiKeyValid && apiKey) {
        const result = await generateAnswerWithGemini(
          text,
          retrievedChunks,
          updatedMessages,
          apiKey,
          currentMode,
          selectedModel
        );
        answerText = result.text;
        citations = result.citations;
      } else {
        if (currentMode === 'general') {
          answerText = `I am running in **Local Fallback Mode** because no Google Gemini API Key is configured.

To ask open-ended questions, write code, or have general conversations (like ChatGPT), please paste a valid Google Gemini API Key into the settings box at the bottom of the sidebar. You can get a free key from [Google AI Studio](https://aistudio.google.com/).

*Currently, without an API key, you can still query uploaded documents using keyword search in **Document Q&A** mode.*`;
          citations = [];
        } else {
          const result = generateLocalExtractiveAnswer(text, retrievedChunks);
          answerText = result.text;
          citations = result.citations;
        }
      }

      // 4. Add assistant response
      const assistantMessage: Message = {
        id: `msg-assistant-${Date.now()}`,
        sender: 'assistant',
        text: answerText,
        timestamp: new Date().toISOString(),
        citations
      };

      const finalSession = {
        ...updatedSession,
        messages: [...updatedMessages, assistantMessage]
      };

      saveSessions(sessions.map(s => s.id === currentSessionId ? finalSession : s));
    } catch (err: any) {
      console.error('Error answering question:', err);
      
      let friendlyMessage = err.message || 'An unexpected error occurred. Please verify your connection or API key.';
      if (friendlyMessage.toLowerCase().includes('failed to fetch') || friendlyMessage.toLowerCase().includes('networkerror')) {
        friendlyMessage = `Network connection failed. This usually happens if:
1. You are offline or experiencing a temporary internet drop.
2. A browser extension (such as an ad-blocker, script blocker, or privacy guard) is blocking connection requests to Google's API (\`generativelanguage.googleapis.com\`). Please try disabling your ad-blocker for this localhost page or white-listing the Google API domain, then try again.`;
      }

      const errorMessage: Message = {
        id: `msg-assistant-err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Error generating response**:\n\n${friendlyMessage}`,
        timestamp: new Date().toISOString()
      };
      
      const finalSession = {
        ...updatedSession,
        messages: [...updatedMessages, errorMessage]
      };
      saveSessions(sessions.map(s => s.id === currentSessionId ? finalSession : s));
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  // --- Render Workspace ---
  const activeSession = sessions.find(s => s.id === currentSessionId) || null;
  const currentMode = activeSession?.chatMode || (files.length > 0 ? 'documents' : 'general');

  return (
    <div className="app-container">
      {/* Sidebar Control Panel */}
      <Sidebar
        files={files}
        onUpload={handleUpload}
        onDeleteFile={handleDeleteFile}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        isApiKeyValid={isApiKeyValid}
        isValidatingApiKey={isValidatingApiKey}
        onLoadDemo={handleLoadDemo}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        ragLimit={ragLimit}
        onRagLimitChange={setRagLimit}
        onToggleFileInSession={handleToggleFileInSession}
        onRenameSession={handleRenameSession}
        onResetApp={handleResetApp}
      />

      {/* Main Chat Workspace */}
      <ChatArea
        session={activeSession}
        files={files}
        chatMode={currentMode}
        onChatModeChange={handleChatModeChange}
        onSendMessage={handleSendMessage}
        isLoading={isLoadingAnswer}
        onSelectCitation={setActiveCitation}
        onLoadDemo={handleLoadDemo}
      />

      {/* Slide-out Document Citation Inspector */}
      {activeCitation && (
        <SourceViewer
          citation={activeCitation}
          onClose={() => setActiveCitation(null)}
        />
      )}
    </div>
  );
}
