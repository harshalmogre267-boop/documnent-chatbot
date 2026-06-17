import React, { useState, useRef } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  UploadCloud, 
  FileText, 
  Key, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Loader2,
  BookOpen
} from 'lucide-react';
import type { DocumentFile, ChatSession } from '../types';

interface SidebarProps {
  files: DocumentFile[];
  onUpload: (files: FileList) => void;
  onDeleteFile: (id: string) => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  isApiKeyValid: boolean;
  isValidatingApiKey: boolean;
  onLoadDemo: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  ragLimit: number;
  onRagLimitChange: (limit: number) => void;
  onToggleFileInSession: (fileId: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onResetApp: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  onUpload,
  onDeleteFile,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  apiKey,
  onApiKeyChange,
  isApiKeyValid,
  isValidatingApiKey,
  onLoadDemo,
  selectedModel,
  onModelChange,
  ragLimit,
  onRagLimitChange,
  onToggleFileInSession,
  onRenameSession,
  onResetApp
}) => {
  const [showKey, setShowKey] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rename session states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  const activeSession = sessions.find(s => s.id === currentSessionId);

  const startEditing = (id: string, currentTitle: string) => {
    setEditingSessionId(id);
    setEditTitleValue(currentTitle);
  };

  const saveTitle = (id: string) => {
    if (editTitleValue.trim()) {
      onRenameSession(id, editTitleValue.trim());
    }
    setEditingSessionId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      saveTitle(id);
    } else if (e.key === 'Escape') {
      setEditingSessionId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
  };

  return (
    <aside className="sidebar">
      {/* Sidebar Header / Logo */}
      <div className="sidebar-brand">
        <div className="logo-icon-wrapper">
          <Sparkles className="logo-sparkle" size={20} />
        </div>
        <div className="brand-info">
          <h2>Document Chatbot</h2>
          <span>Knowledge Base Assistant</span>
        </div>
      </div>

      {/* Action Button: New Chat */}
      <button className="btn btn-primary new-chat-btn" onClick={onNewSession}>
        <Plus size={18} />
        <span>New Chat Session</span>
      </button>

      {/* Main Sidebar Scrollable Content */}
      <div className="sidebar-content">
        
        {/* Document Section */}
        <div className="sidebar-section">
          <div className="section-header">
            <h3>Uploaded Documents</h3>
            <span className="badge-count">{files.length}</span>
          </div>

          {/* Upload Drop Zone */}
          <div 
            className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              multiple 
              accept=".pdf,.docx,.txt"
              style={{ display: 'none' }}
            />
            <UploadCloud size={28} className="upload-icon" />
            <p>Drag files or click to upload</p>
            <span>PDF, DOCX, TXT</span>
          </div>

          {/* Quick Load Demo Button */}
          {files.length === 0 && (
            <button className="btn btn-outline demo-load-btn" onClick={onLoadDemo}>
              <BookOpen size={14} />
              <span>Load AI Guide Demo</span>
            </button>
          )}

          {/* Uploaded Files List */}
          {files.length > 0 && (
            <div className="files-list">
              {files.map((file) => (
                <div key={file.id} className={`file-item status-${file.status}`}>
                  {currentSessionId && file.status === 'indexed' && (
                    <input 
                      type="checkbox"
                      className="file-session-checkbox"
                      checked={activeSession?.fileIds.includes(file.id) || false}
                      onChange={() => onToggleFileInSession(file.id)}
                      title="Include file in active chat session context"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <FileText className="file-icon" size={16} />
                  <div className="file-details">
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-meta">
                      {formatFileSize(file.size)} • {
                        file.status === 'parsing' ? 'Parsing...' :
                        file.status === 'indexed' ? `${file.chunksCount} chunks` :
                        'Error'
                      }
                    </span>
                  </div>
                  <div className="file-actions">
                    {file.status === 'parsing' && (
                      <Loader2 className="spinner" size={14} />
                    )}
                    {file.status === 'error' && (
                      <div className="error-tooltip-trigger" title={file.error || 'Parsing failed'}>
                        <AlertCircle className="error-icon" size={16} />
                      </div>
                    )}
                    <button 
                      className="btn-icon delete-btn" 
                      onClick={() => onDeleteFile(file.id)}
                      title="Remove document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sessions Section */}
        <div className="sidebar-section">
          <div className="section-header">
            <h3>Recent Sessions</h3>
            <span className="badge-count">{sessions.length}</span>
          </div>
          
          {sessions.length === 0 ? (
            <div className="empty-section-message">
              No recent chat sessions
            </div>
          ) : (
            <div className="sessions-list">
              {sessions.map((session) => (
                <div 
                  key={session.id} 
                  className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                  onClick={() => onSelectSession(session.id)}
                >
                  <MessageSquare size={16} className="session-icon" />
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      className="session-title-edit-input"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                      onBlur={() => saveTitle(session.id)}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span 
                      className="session-title" 
                      title={session.title}
                      onDoubleClick={() => startEditing(session.id, session.title)}
                    >
                      {session.title}
                    </span>
                  )}
                  <button 
                    className="btn-icon delete-session-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="Delete session"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings / API Key section */}
      <div className="sidebar-settings">
        <div className="settings-header">
          <Key size={16} />
          <h4>Google Gemini API Settings</h4>
        </div>
        
        <div className="api-key-input-wrapper">
          <input 
            type={showKey ? 'text' : 'password'} 
            placeholder="Enter Gemini API Key..." 
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
          <button 
            type="button" 
            className="btn-icon toggle-visibility-btn"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <div className="api-status-row">
          {apiKey ? (
            isValidatingApiKey ? (
              <div className="api-status validating">
                <Loader2 className="spinner" size={14} />
                <span>Verifying key...</span>
              </div>
            ) : isApiKeyValid ? (
              <div className="api-status valid">
                <CheckCircle2 size={14} />
                <span>API Connected</span>
              </div>
            ) : (
              <div className="api-status invalid">
                <AlertCircle size={14} />
                <span>Invalid API Key</span>
              </div>
            )
          ) : (
            <div className="api-status fallback">
              <span className="pulse-dot"></span>
              <span>Local Search Mode</span>
            </div>
          )}
        </div>

        <p className="settings-help">
          Your key remains in your browser. Get a free API key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio</a>.
        </p>

        {/* Collapsible Advanced Settings */}
        <details className="advanced-settings-details">
          <summary className="advanced-settings-summary">
            <span>Advanced Configuration</span>
          </summary>
          <div className="advanced-settings-content">
            {/* Model Select */}
            <div className="setting-group">
              <label>Gemini Model</label>
              <select 
                value={selectedModel} 
                onChange={(e) => onModelChange(e.target.value)}
                className="setting-select"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (High Quality)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </select>
            </div>
            
            {/* RAG Limit Slider */}
            <div className="setting-group">
              <div className="setting-label-row">
                <label>RAG Context Chunks</label>
                <span className="setting-value">{ragLimit} chunks</span>
              </div>
              <input 
                type="range" 
                min="2" 
                max="8" 
                value={ragLimit} 
                onChange={(e) => onRagLimitChange(parseInt(e.target.value, 10))}
                className="setting-range"
              />
            </div>
            
            {/* Reset App Button */}
            <button 
              className="btn btn-outline reset-app-btn" 
              onClick={onResetApp}
              title="Clear all sessions, settings, and documents"
            >
              Reset Application Data
            </button>
          </div>
        </details>
      </div>
    </aside>
  );
};
