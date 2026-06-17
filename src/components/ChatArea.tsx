import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, ArrowRight, Sparkles, MessageSquare, BookOpen, User, Download } from 'lucide-react';
import type { ChatSession, DocumentFile, Citation } from '../types';

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">{language || 'code'}</span>
        <button className="btn-copy-code" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
};

interface ChatAreaProps {
  session: ChatSession | null;
  files: DocumentFile[];
  chatMode: 'documents' | 'general';
  onChatModeChange: (mode: 'documents' | 'general') => void;
  apiKey: string;
  isApiKeyValid: boolean;
  onSendMessage: (text: string) => void;
  isLoading: React.ReactNode | boolean; // supports boolean or custom indicator
  onSelectCitation: (citation: Citation) => void;
  onLoadDemo: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  session,
  files,
  chatMode,
  onChatModeChange,
  apiKey,
  isApiKeyValid,
  onSendMessage,
  isLoading,
  onSelectCitation,
  onLoadDemo
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeMessages = session ? session.messages : [];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isLoading]);

  // Auto-resize input textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputValue]);

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Custom light-weight markdown parser
  const parseInlineStyles = (text: string, citations: Citation[] = []): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|`.*?`|\[\d+\])/g;
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="inline-code">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('[') && part.endsWith(']')) {
        const citationNumber = parseInt(part.slice(1, -1), 10);
        const citationIndex = citationNumber - 1;
        
        if (citations && citations[citationIndex]) {
          const citation = citations[citationIndex];
          return (
            <button
              key={i}
              className="inline-citation-badge"
              onClick={() => onSelectCitation(citation)}
              title={`Source: ${citation.fileName} ${citation.pageNumber ? `(Page ${citation.pageNumber})` : ''}`}
            >
              {citationNumber}
            </button>
          );
        }
      }
      return part;
    });
  };

  const formatMessageText = (text: string, citations: Citation[] = []): React.ReactNode => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    
    let insideCodeBlock = false;
    let codeBlockLines: string[] = [];
    let codeLanguage = '';
    
    let insideBulletList = false;
    let bulletListItems: React.ReactNode[] = [];
    
    let insideNumberedList = false;
    let numberedListItems: React.ReactNode[] = [];
    
    const flushLists = (keyPrefix: string) => {
      if (insideBulletList) {
        insideBulletList = false;
        elements.push(
          <ul key={`ul-${keyPrefix}`} className="parsed-list">
            {bulletListItems}
          </ul>
        );
        bulletListItems = [];
      }
      if (insideNumberedList) {
        insideNumberedList = false;
        elements.push(
          <ol key={`ol-${keyPrefix}`} className="parsed-list numbered">
            {numberedListItems}
          </ol>
        );
        numberedListItems = [];
      }
    };
    
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      
      // Handle Code Block fence
      if (line.trim().startsWith('```')) {
        if (insideCodeBlock) {
          // Close code block
          insideCodeBlock = false;
          const codeText = codeBlockLines.join('\n');
          elements.push(
            <CodeBlock key={`code-${idx}`} code={codeText} language={codeLanguage} />
          );
          codeBlockLines = [];
          codeLanguage = '';
        } else {
          flushLists(`before-code-${idx}`);
          insideCodeBlock = true;
          codeLanguage = line.trim().substring(3).trim();
        }
        continue;
      }
      
      if (insideCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }
      
      // Handle Headers
      if (line.startsWith('#')) {
        flushLists(`before-header-${idx}`);
        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const content = headerMatch[2];
          const HeaderTag = `h${level}` as any;
          elements.push(
            <HeaderTag key={`header-${idx}`} className={`parsed-h${level}`}>
              {parseInlineStyles(content, citations)}
            </HeaderTag>
          );
          continue;
        }
      }
      
      // Handle Blockquotes
      if (line.startsWith('> ')) {
        flushLists(`before-quote-${idx}`);
        const content = line.substring(2);
        elements.push(
          <blockquote key={`quote-${idx}`} className="parsed-quote">
            {parseInlineStyles(content, citations)}
          </blockquote>
        );
        continue;
      }
      
      // Handle Bullet Lists
      const bulletMatch = line.match(/^[\*\-]\s+(.*)$/);
      if (bulletMatch) {
        if (insideNumberedList) flushLists(`switch-list-bullet-${idx}`);
        insideBulletList = true;
        bulletListItems.push(
          <li key={`li-bullet-${idx}`}>
            {parseInlineStyles(bulletMatch[1], citations)}
          </li>
        );
        continue;
      }
      
      // Handle Numbered Lists
      const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
      if (numberedMatch) {
        if (insideBulletList) flushLists(`switch-list-number-${idx}`);
        insideNumberedList = true;
        numberedListItems.push(
          <li key={`li-num-${idx}`}>
            {parseInlineStyles(numberedMatch[1], citations)}
          </li>
        );
        continue;
      }
      
      // Empty line
      if (line.trim() === '') {
        flushLists(`space-${idx}`);
        elements.push(<div key={`space-${idx}`} className="parsed-space" />);
        continue;
      }
      
      // Standard Paragraph
      flushLists(`before-p-${idx}`);
      elements.push(
        <p key={`p-${idx}`} className="parsed-p">
          {parseInlineStyles(line, citations)}
        </p>
      );
    }
    
    flushLists('final');
    
    return elements;
  };

  const handleExportMarkdown = () => {
    if (!session) return;
    
    let markdown = `# Chat Session: ${session.title}\n`;
    markdown += `Date: ${new Date(session.createdAt).toLocaleDateString()}\n\n`;
    
    session.messages.forEach((msg) => {
      const role = msg.sender === 'user' ? 'User' : 'Document Chatbot';
      markdown += `## ${role} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n`;
      markdown += `${msg.text}\n\n`;
      
      if (msg.citations && msg.citations.length > 0) {
        markdown += `### Sources cited:\n`;
        msg.citations.forEach((cit, idx) => {
          const pageInfo = cit.pageNumber ? `, Page ${cit.pageNumber}` : '';
          markdown += `- [${idx + 1}] ${cit.fileName}${pageInfo}: "${cit.text.substring(0, 150).trim()}..."\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    });
    
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${session.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_chat.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="chat-area">
      
      {/* Session Title Header Banner */}
      <div className="chat-header">
        <div className="header-info">
          <MessageSquare size={18} className="header-icon" />
          <h2>{session ? session.title : 'Select a Chat'}</h2>
        </div>
        
        {session && session.messages.length > 0 && (
          <button 
            className="btn btn-outline export-chat-btn" 
            onClick={handleExportMarkdown}
            title="Export chat history to Markdown file"
          >
            <Download size={14} />
            <span>Export Chat</span>
          </button>
        )}
        
        {session && (
          <div className="mode-selector-tabs">
            <button 
              className={`mode-tab ${chatMode === 'documents' ? 'active' : ''}`}
              onClick={() => onChatModeChange('documents')}
              title="Query and summarize uploaded files"
            >
              <FileText size={13} />
              <span>Document Q&A</span>
            </button>
            <button 
              className={`mode-tab ${chatMode === 'general' ? 'active' : ''}`}
              onClick={() => onChatModeChange('general')}
              title="Chat openly with Gemini like ChatGPT"
            >
              <Sparkles size={13} />
              <span>General Assistant</span>
            </button>
          </div>
        )}

        {files.length > 0 && chatMode === 'documents' && (
          <div className="indexed-indicator">
            <span className="dot active"></span>
            <span>Querying {files.length} document{files.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Message Feed / Workspace Grid */}
      <div className="messages-container">
        {activeMessages.length === 0 ? (
          /* Premium Empty Dashboard Onboarding */
          <div className="welcome-dashboard">
            <div className="welcome-hero animate-fade-in">
              <div className="welcome-logo">
                <Sparkles size={32} />
              </div>
              <h1>
                {chatMode === 'documents' 
                  ? 'Interact with Your Documents' 
                  : 'Chat with AI Assistant'}
              </h1>
              <p>
                {chatMode === 'documents' 
                  ? 'Upload lecture notes, research documents, guidelines, or business reports, and instantly search, summarize, or query them using AI.' 
                  : 'Ask anything, write code, explore ideas, or converse with the AI in an open-ended conversational session (like ChatGPT).'}
              </p>
            </div>

            <div className="welcome-cards">
              <div className="onboarding-card animate-slide-up-1">
                <div className="card-number">1</div>
                <h3>Upload files</h3>
                <p>Drag PDF, DOCX, or TXT files directly into the sidebar to parse and index their contents locally.</p>
              </div>
              <div className="onboarding-card animate-slide-up-2">
                <div className="card-number">2</div>
                <h3>Ask questions</h3>
                <p>Type in natural language, ask for summaries, search specific topics, or request paragraph citations.</p>
              </div>
              <div className="onboarding-card animate-slide-up-3">
                <div className="card-number">3</div>
                <h3>Verify sources</h3>
                <p>Click dynamic citation badges on responses to inspect the source document text page-by-page.</p>
              </div>
            </div>

            {files.length === 0 && (
              <div className="welcome-demo-prompt animate-fade-in">
                <p>No documents uploaded yet? Test-drive the app immediately in Demo Mode.</p>
                <button className="btn btn-gradient" onClick={onLoadDemo}>
                  <BookOpen size={16} />
                  <span>Try Demo Knowledge Base</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Active Chat Conversation Feed */
          <div className="message-list">
            {activeMessages.map((msg) => (
              <div key={msg.id} className={`message-bubble-wrapper ${msg.sender}`}>
                <div className="avatar-wrapper">
                  {msg.sender === 'user' ? (
                    <User size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </div>
                
                <div className="message-bubble-content">
                  <div className="message-text">
                    {formatMessageText(msg.text, msg.citations)}
                  </div>

                  {/* Dynamic Citations Panel */}
                  {msg.sender === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div className="citations-panel">
                      <span className="citations-title">Sources & Citations:</span>
                      <div className="citations-chips">
                        {msg.citations.map((cit, cIdx) => (
                          <button
                            key={`${cit.chunkId}-${cIdx}`}
                            className="citation-chip"
                            onClick={() => onSelectCitation(cit)}
                            title="Click to view raw context source"
                          >
                            <FileText size={12} />
                            <span>
                              {cit.fileName} {cit.pageNumber ? `(Page ${cit.pageNumber})` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Pulsing loading state */}
            {isLoading && (
              <div className="message-bubble-wrapper assistant loading">
                <div className="avatar-wrapper">
                  <Sparkles className="logo-sparkle spinner" size={16} />
                </div>
                <div className="message-bubble-content">
                  <div className="typing-loader">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Chat Input Bar */}
      <div className="chat-input-container">
        {chatMode === 'documents' && files.length === 0 && (
          <div className="input-warning-banner">
            <span>⚠️ Please upload a document or load the demo file to start querying in Document mode.</span>
          </div>
        )}
        {chatMode === 'general' && (!apiKey || !isApiKeyValid) && (
          <div className="input-warning-banner general-warn">
            <span>💡 Note: Open-ended chat requires a valid Gemini API Key. Configure it in the sidebar.</span>
          </div>
        )}
        
        <div className="input-row">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              !session 
                ? "Select a chat session first..." 
                : chatMode === 'documents' 
                  ? files.length === 0 
                    ? "Upload documents to begin..." 
                    : "Ask a question about your documents..." 
                  : "Type a message (ChatGPT mode)..."
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={
              !session || 
              (chatMode === 'documents' && files.length === 0) || 
              !!isLoading
            }
          />
          <button
            className={`btn btn-icon send-btn ${inputValue.trim() && (chatMode === 'general' || files.length > 0) && !isLoading ? 'active' : ''}`}
            onClick={handleSend}
            disabled={
              !inputValue.trim() || 
              !session ||
              (chatMode === 'documents' && files.length === 0) || 
              !!isLoading
            }
            title="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </main>
  );
};
