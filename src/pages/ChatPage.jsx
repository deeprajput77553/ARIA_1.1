import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, Database, GitBranch, Cpu, Eye, CheckCircle2, ChevronDown, Bot, User, RefreshCw, X, Copy, Trash2, Edit3, RotateCcw, Check, Plus, History, Download, Printer, ZoomIn, ZoomOut, FileText } from 'lucide-react';

function ChatPage({ 
    messages, 
    setMessages, 
    connected, 
    wsRef,
    sessions = [],
    activeSessionId,
    createNewSession,
    changeActiveSession,
    deleteSession
}) {
    const [inputText, setInputText] = useState('');
    const [expandedPipelines, setExpandedPipelines] = useState({});
    const [previewFile, setPreviewFile] = useState(null); // { name: '...', url: '...' }
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [paperTheme, setPaperTheme] = useState('light');
    
    // Message Action States
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    const chatEndRef = useRef(null);
    const previewContainerRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!previewFile || !previewContainerRef.current) return;
        
        let active = true;
        setLoadingPreview(true);
        
        // Clear previous content
        previewContainerRef.current.innerHTML = '';
        
        const loadDocx = async () => {
            try {
                const response = await fetch(previewFile.url);
                if (!response.ok) throw new Error("Failed to fetch document");
                const arrayBuffer = await response.arrayBuffer();
                
                if (!active) return;
                
                // Import docx-preview dynamically
                const docx = await import('docx-preview');
                
                if (!active) return;
                
                await docx.renderAsync(arrayBuffer, previewContainerRef.current, null, {
                    className: "docx-preview-container",
                    inWrapper: false,
                    ignoreWidth: true,
                    ignoreHeight: true,
                });
            } catch (err) {
                console.error("Failed to render docx:", err);
                if (active && previewContainerRef.current) {
                    previewContainerRef.current.innerHTML = `<div class="preview-error">Failed to load and render document: ${err.message}</div>`;
                }
            } finally {
                if (active) setLoadingPreview(false);
            }
        };
        
        loadDocx();
        
        return () => {
            active = false;
        };
    }, [previewFile]);

    const renderMessageContent = (msg) => {
        if (!msg.text) {
            if (msg.id === 'ai-pending') {
                return (
                    <span className="thinking-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                );
            }
            return '';
        }

        const isDev = window.location.hostname === 'localhost' && window.location.port !== '4200';
        const apiBase = isDev ? 'http://localhost:4200' : window.location.origin;

        const imgRegex = /images\/[a-zA-Z0-9_\-]+\.png/g;
        const imagesFound = [...new Set([...msg.text.matchAll(imgRegex)].map(m => m[0]))];

        const docxRegex = /\b[a-zA-Z0-9_\-]+\.docx\b/g;
        const docxFound = [...new Set([...msg.text.matchAll(docxRegex)].map(m => m[0]))];
        
        const mdRegex = /\b[a-zA-Z0-9_\-]+\.md\b/g;
        const mdFound = [...new Set([...msg.text.matchAll(mdRegex)].map(m => m[0]))].filter(f => f !== 'plan.md' && f !== 'README.md');

        const renderLineInline = (str) => {
            const regex = /(!\[.*?\]\(.*?\))|(\[.*?\]\(.*?\))|(\*\*.*?\*\*)|(`.*?`)/g;
            const parts = str.split(regex);
            
            return parts.map((part, partIdx) => {
                if (!part) return null;
                
                // 1. Scraped Web Image
                if (part.startsWith('![') && part.endsWith(')')) {
                    const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
                    if (imgMatch) {
                        const alt = imgMatch[1];
                        const url = imgMatch[2];
                        return (
                            <div key={partIdx} className="scraped-image-card-inline">
                                <div className="scraped-image-wrapper">
                                    <img 
                                        src={url} 
                                        alt={alt} 
                                        className="scraped-image-element" 
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }} 
                                    />
                                    <div className="scraped-image-error" style={{ display: 'none' }}>
                                        <span>Failed to load image</span>
                                    </div>
                                </div>
                                <div className="scraped-image-title">{alt || 'Scraped Image'}</div>
                            </div>
                        );
                    }
                }
                
                // 2. Clickable Web Link
                if (part.startsWith('[') && part.endsWith(')')) {
                    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
                    if (linkMatch) {
                        const label = linkMatch[1];
                        const url = linkMatch[2];
                        return (
                            <a 
                                key={partIdx} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="scraped-link-element"
                            >
                                {label}
                            </a>
                        );
                    }
                }
                
                // 3. Bold Text
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={partIdx} className="md-bold">{part.slice(2, -2)}</strong>;
                }
                
                // 4. Inline Code
                if (part.startsWith('`') && part.endsWith('`')) {
                    return <code key={partIdx} className="md-inline-code">{part.slice(1, -1)}</code>;
                }
                
                // Plain Text
                return <span key={partIdx}>{part}</span>;
            });
        };

        const parseMarkdownToReact = (text) => {
            const lines = text.split('\n');
            return lines.map((line, lineIdx) => {
                // Headers
                if (line.startsWith('### ')) {
                    return <h4 key={lineIdx} className="md-h4">{renderLineInline(line.slice(4))}</h4>;
                }
                if (line.startsWith('## ')) {
                    return <h3 key={lineIdx} className="md-h3">{renderLineInline(line.slice(3))}</h3>;
                }
                if (line.startsWith('# ')) {
                    return <h2 key={lineIdx} className="md-h2">{renderLineInline(line.slice(2))}</h2>;
                }
                
                // Lists
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    return (
                        <div key={lineIdx} className="md-list-item">
                            <span className="md-bullet">•</span>
                            <span className="md-list-text">{renderLineInline(line.slice(2))}</span>
                        </div>
                    );
                }
                
                const numListMatch = line.match(/^(\d+)\.\s(.*)/);
                if (numListMatch) {
                    const num = numListMatch[1];
                    const content = numListMatch[2];
                    return (
                        <div key={lineIdx} className="md-list-item numbered">
                            <span className="md-number">{num}.</span>
                            <span className="md-list-text">{renderLineInline(content)}</span>
                        </div>
                    );
                }
                
                return <div key={lineIdx} className="chat-text-line">{renderLineInline(line)}</div>;
            });
        };

        return (
            <div className="rendered-message-body">
                <div className="message-text-paragraphs">{parseMarkdownToReact(msg.text)}</div>
                
                {/* Render local NVIDIA FLUX generated images */}
                {imagesFound.length > 0 && (
                    <div className="generated-images-gallery">
                        {imagesFound.map((imgName, idx) => {
                            const imgSrc = `${apiBase}/workspace/${imgName}`;
                            return (
                                <div key={idx} className="generated-image-card">
                                    <div className="image-card-preview-wrapper">
                                        <img 
                                            src={imgSrc} 
                                            alt="Generated by Aria" 
                                            className="generated-image-element"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div className="image-error-fallback" style={{ display: 'none' }}>
                                            <span>Image failed to load</span>
                                        </div>
                                    </div>
                                    <a 
                                        href={imgSrc} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="image-card-action-btn"
                                    >
                                        Open Full Image
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Render docx files */}
                {docxFound.length > 0 && (
                    <div className="generated-files-list">
                        {docxFound.map((fileName, idx) => {
                            const fileUrl = `${apiBase}/workspace/${fileName}`;
                            return (
                                <div key={idx} className="generated-file-download-card">
                                    <div className="file-info-group">
                                        <div className="file-icon-wrapper docx">
                                            <Database size={20} />
                                        </div>
                                        <div className="file-details">
                                            <div className="file-name-label">{fileName}</div>
                                            <div className="file-meta-label">Microsoft Word Document (.docx)</div>
                                        </div>
                                    </div>
                                    <div className="file-actions-group">
                                        <button 
                                            onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                                            className="file-preview-action-btn"
                                        >
                                            Preview
                                        </button>
                                        <a 
                                            href={fileUrl} 
                                            download 
                                            className="file-download-action-btn"
                                        >
                                            Download
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {/* Render md files */}
                {mdFound.length > 0 && (
                    <div className="generated-files-list">
                        {mdFound.map((fileName, idx) => {
                            const fileUrl = `${apiBase}/workspace/${fileName}`;
                            return (
                                <div key={idx} className="generated-file-download-card">
                                    <div className="file-info-group">
                                        <div className="file-icon-wrapper md">
                                            <MessageSquare size={20} />
                                        </div>
                                        <div className="file-details">
                                            <div className="file-name-label">{fileName}</div>
                                            <div className="file-meta-label">Markdown Document (.md)</div>
                                        </div>
                                    </div>
                                    <a 
                                        href={fileUrl} 
                                        download 
                                        className="file-download-action-btn"
                                    >
                                        Download Markdown
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const handleSend = () => {
        if (!inputText.trim() || !connected) return;

        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: inputText,
            timestamp: new Date().toLocaleTimeString()
        };

        const pendingAiMsg = {
            id: 'ai-pending',
            sender: 'ai',
            text: '',
            timestamp: new Date().toLocaleTimeString(),
            logs: [],
            pipeline: {
                input: { status: 'active', detail: 'Waiting...', badge: 'ACTIVE' },
                context: { status: '', detail: '-', badge: '-' },
                router: { status: '', detail: '-', badge: '-' },
                exec: { status: '', detail: '-', badge: '-' },
                reflect: { status: '', detail: '-', badge: '-' },
                output: { status: '', detail: '-', badge: '-' }
            }
        };

        // Append user prompt and placeholder for AI streaming
        setMessages(prev => [...prev, userMsg, pendingAiMsg]);

        window.playUISound('send');

        // Transmit via WS to Node backend
        wsRef.current.send(JSON.stringify({
            type: 'chat:message',
            prompt: inputText
        }));

        setInputText('');
    };

    const handleStopResponse = () => {
        window.playUISound('error');

        // Cancel Speech Synthesis (in case TTS is active)
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        // Send explicit stop command to backend
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(JSON.stringify({ type: 'chat:stop' }));
            } catch (err) {
                console.warn("[WebSocket] Failed to send chat:stop:", err);
            }
        }

        // Finalize pending AI message and reset its pipeline state locally
        setMessages(prev => {
            const pendingIdx = prev.findIndex(m => m.id === 'ai-pending');
            if (pendingIdx === -1) return prev;
            const pendingMsg = prev[pendingIdx];
            const finalizedText = pendingMsg.text ? pendingMsg.text + " [Stopped]" : "[Generation stopped]";
            const updated = [...prev];
            updated[pendingIdx] = {
                ...pendingMsg,
                id: Date.now() + Math.random(),
                text: finalizedText,
                pipeline: {
                    input: { status: 'done', detail: 'Stopped', badge: 'IDLE' },
                    context: { status: '', detail: '-', badge: '-' },
                    router: { status: '', detail: '-', badge: '-' },
                    exec: { status: '', detail: '-', badge: '-' },
                    reflect: { status: '', detail: '-', badge: '-' },
                    output: { status: '', detail: '-', badge: '-' }
                }
            };
            return updated;
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const togglePipeline = (msgId) => {
        setExpandedPipelines(prev => ({
            ...prev,
            [msgId]: !prev[msgId]
        }));
    };

    // Message Actions Implementations
    const handleCopyMessage = (msgId, text) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(msgId);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const handleStartEdit = (msg) => {
        setEditingMessageId(msg.id);
        setEditingText(msg.text);
    };

    const handleSaveEdit = (msgId) => {
        if (!editingText.trim()) return;
        const msgIdx = messages.findIndex(m => m.id === msgId);
        if (msgIdx === -1) return;

        // Truncate message stream up to edited prompt
        const truncatedMessages = messages.slice(0, msgIdx + 1);
        truncatedMessages[msgIdx] = {
            ...truncatedMessages[msgIdx],
            text: editingText,
            timestamp: new Date().toLocaleTimeString()
        };

        const pendingAiMsg = {
            id: 'ai-pending',
            sender: 'ai',
            text: '',
            timestamp: new Date().toLocaleTimeString(),
            logs: [],
            pipeline: {
                input: { status: 'active', detail: 'Waiting...', badge: 'ACTIVE' },
                context: { status: '', detail: '-', badge: '-' },
                router: { status: '', detail: '-', badge: '-' },
                exec: { status: '', detail: '-', badge: '-' },
                reflect: { status: '', detail: '-', badge: '-' },
                output: { status: '', detail: '-', badge: '-' }
            }
        };

        const finalMessages = [...truncatedMessages, pendingAiMsg];
        setMessages(finalMessages);

        // Sync history context
        const backendHistory = truncatedMessages
            .filter(m => m.id !== 'welcome' && m.id !== 'ai-pending')
            .map(m => ({
                role: m.sender === 'ai' ? 'assistant' : 'user',
                content: m.text,
                ts: typeof m.id === 'number' ? m.id : Date.now()
            }));

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat:sync_history',
                history: backendHistory
            }));
            wsRef.current.send(JSON.stringify({
                type: 'chat:message',
                prompt: editingText
            }));
        }

        setEditingMessageId(null);
        setEditingText('');
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditingText('');
    };

    const handleRegenerate = (msgId) => {
        const msgIdx = messages.findIndex(m => m.id === msgId);
        if (msgIdx === -1) return;

        const userMsg = messages[msgIdx - 1];
        if (!userMsg || userMsg.sender !== 'user') return;

        // Truncate history excluding the current AI message
        const truncatedMessages = messages.slice(0, msgIdx);

        const pendingAiMsg = {
            id: 'ai-pending',
            sender: 'ai',
            text: '',
            timestamp: new Date().toLocaleTimeString(),
            logs: [],
            pipeline: {
                input: { status: 'active', detail: 'Waiting...', badge: 'ACTIVE' },
                context: { status: '', detail: '-', badge: '-' },
                router: { status: '', detail: '-', badge: '-' },
                exec: { status: '', detail: '-', badge: '-' },
                reflect: { status: '', detail: '-', badge: '-' },
                output: { status: '', detail: '-', badge: '-' }
            }
        };

        const finalMessages = [...truncatedMessages, pendingAiMsg];
        setMessages(finalMessages);

        const backendHistory = truncatedMessages
            .filter(m => m.id !== 'welcome' && m.id !== 'ai-pending')
            .map(m => ({
                role: m.sender === 'ai' ? 'assistant' : 'user',
                content: m.text,
                ts: typeof m.id === 'number' ? m.id : Date.now()
            }));

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat:sync_history',
                history: backendHistory
            }));
            wsRef.current.send(JSON.stringify({
                type: 'chat:message',
                prompt: userMsg.text
            }));
        }
    };

    const handleDeleteMessage = (msgId) => {
        const updatedMessages = messages.filter(m => m.id !== msgId);
        setMessages(updatedMessages);

        const backendHistory = updatedMessages
            .filter(m => m.id !== 'welcome' && m.id !== 'ai-pending')
            .map(m => ({
                role: m.sender === 'ai' ? 'assistant' : 'user',
                content: m.text,
                ts: typeof m.id === 'number' ? m.id : Date.now()
            }));

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat:sync_history',
                history: backendHistory
            }));
        }
    };

    const suggestionPrompts = [
        { label: 'Say hello to Aria', text: 'hi' },
        { label: 'Check system models list', text: '/models' },
        { label: 'Display profile details', text: '/profile' },
        { label: 'Generate a tech diagram', text: 'Generate an image of a distributed network diagram with a central database and 3 server nodes.' }
    ];

    // Render pipeline status inside message
    const renderInlinePipeline = (msg) => {
        if (!msg.logs || msg.logs.length === 0) return null;
        const isExpanded = expandedPipelines[msg.id];

        return (
            <div className="inline-pipeline-box">
                <button className="pipeline-toggle-header" onClick={() => togglePipeline(msg.id)}>
                    <Sparkles size={14} className="sparkle-gold" />
                    <span className="pipeline-header-label">Reasoning & Execution Trace</span>
                    <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </button>

                {isExpanded && (
                    <div className="pipeline-expanded-steps log-trace-mode">
                        {[...msg.logs].reverse().map((log, index) => (
                            <div key={log.id || index} className="inline-log-row-stacked">
                                <div className="log-time">{log.time}</div>
                                <div className={`log-level-badge-stacked ${log.level.toLowerCase()}`}>
                                    {log.level.toUpperCase()}
                                </div>
                                <div className="log-msg-text">{log.message}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const isAriaThinking = messages.length > 0 && messages[messages.length - 1].id === 'ai-pending';

    return (
        <div className="chat-page-layout-wrapper">
            {/* Left Chat History Panel Sidebar */}
            <div className="chat-sidebar-panel">
                <button className="new-chat-btn" onClick={createNewSession}>
                    <Plus size={16} /> New Chat
                </button>
                
                <div className="chat-history-list">
                    <div className="history-section-title">
                        <History size={12} /> Conversations
                    </div>
                    <div className="sessions-scroll-viewport">
                        {sessions.map(session => (
                            <div 
                                key={session.id} 
                                className={`chat-session-item ${session.id === activeSessionId ? 'active' : ''}`}
                                onClick={() => changeActiveSession(session.id)}
                            >
                                <MessageSquare size={14} className="session-icon" />
                                <span className="session-title-text" title={session.title}>
                                    {session.title}
                                </span>
                                {sessions.length > 1 && (
                                    <button 
                                        className="delete-session-btn" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteSession(session.id);
                                        }}
                                        title="Delete Chat"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Main Conversational Viewport */}
            <div className="chat-main-content">
                <div className="chat-page-container">
                    <div className="chat-messages-viewport">
                        {messages.length <= 1 ? (
                            <div className="chat-welcome-hero">
                                <div className="welcome-avatar">
                                    <img src="/star.svg" alt="Aria Logo" className="welcome-avatar-star" />
                                </div>
                                <h2 className="welcome-title">Collaborate with Aria</h2>
                                <p className="welcome-subtitle">Your local pipeline-guided AI agent workspace. Type a prompt or run CLI commands directly in the browser.</p>
                                
                                <div className="suggestion-grid">
                                    {suggestionPrompts.map((p, idx) => (
                                        <button key={idx} className="suggestion-card" onClick={() => setInputText(p.text)}>
                                            <span className="suggestion-card-label">{p.label}</span>
                                            <span className="suggestion-card-text">"{p.text}"</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="messages-list">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`message-bubble-wrapper ${msg.sender}`}>
                                        <div className="message-avatar-circle">
                                            {msg.sender === 'ai' ? (
                                                <img src="/star.svg" alt="Aria" className="message-avatar-star" />
                                            ) : (
                                                <User size={18} />
                                            )}
                                        </div>
                                        <div className="message-bubble-body">
                                            <div className="message-meta-header">
                                                <span className="sender-name">{msg.sender === 'ai' ? 'Aria' : 'You'}</span>
                                                <span className="message-time">{msg.timestamp}</span>
                                                
                                                {/* Hover Toolbar Actions */}
                                                {msg.id !== 'ai-pending' && (
                                                    <div className="message-bubble-actions">
                                                        <button 
                                                            className="action-btn" 
                                                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                                                            title="Copy text"
                                                        >
                                                            {copiedId === msg.id ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                                                        </button>

                                                        {msg.sender === 'user' && editingMessageId !== msg.id && (
                                                            <button 
                                                                className="action-btn" 
                                                                onClick={() => handleStartEdit(msg)}
                                                                title="Edit prompt"
                                                            >
                                                                <Edit3 size={12} />
                                                            </button>
                                                        )}

                                                        {msg.sender === 'ai' && msg.id !== 'welcome' && (
                                                            <button 
                                                                className="action-btn" 
                                                                onClick={() => handleRegenerate(msg.id)}
                                                                title="Regenerate response"
                                                            >
                                                                <RotateCcw size={12} />
                                                            </button>
                                                        )}

                                                        {msg.id !== 'welcome' && (
                                                            <button 
                                                                className="action-btn delete" 
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                title="Delete message"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="message-content-text">
                                                {editingMessageId === msg.id ? (
                                                    <div className="message-edit-box">
                                                        <textarea 
                                                            className="message-edit-textarea"
                                                            value={editingText}
                                                            onChange={(e) => setEditingText(e.target.value)}
                                                            rows={Math.max(2, editingText.split('\n').length)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleSaveEdit(msg.id);
                                                                }
                                                            }}
                                                        />
                                                        <div className="message-edit-actions">
                                                            <button className="edit-save-btn" onClick={() => handleSaveEdit(msg.id)}>
                                                                Save & Submit
                                                            </button>
                                                            <button className="edit-cancel-btn" onClick={handleCancelEdit}>
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    renderMessageContent(msg)
                                                )}
                                            </div>
                                            
                                            {msg.sender === 'ai' && renderInlinePipeline(msg)}
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                        )}
                    </div>

                    <div className="chat-input-bar-container">
                        <div className="chat-input-wrapper">
                            <textarea
                                className="chat-input-textarea"
                                placeholder={connected ? "Ask Aria anything or run commands (/models, /profile, /clear)..." : "Connecting to server..."}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={!connected}
                                rows={1}
                            />
                            {isAriaThinking ? (
                                <button 
                                    className="chat-stop-btn active"
                                    onClick={handleStopResponse}
                                    title="Stop generating"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 14H8V8h8v8z"/>
                                    </svg>
                                </button>
                            ) : (
                                <button 
                                    className={`chat-send-btn ${inputText.trim() && connected ? 'active' : ''}`}
                                    onClick={handleSend}
                                    disabled={!inputText.trim() || !connected}
                                >
                                    <Send size={16} />
                                </button>
                            )}
                        </div>
                        {isAriaThinking && (
                            <div className="thinking-status-indicator">
                                <RefreshCw size={12} className="spin" /> Aria is routing and processing your workflow pipeline stages...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Document Preview Modal */}
            {previewFile && (
                <div className="docx-preview-modal-overlay" onClick={() => { setPreviewFile(null); setZoom(100); setPaperTheme('light'); }} style={{ zIndex: 100 }}>
                    <div className="docx-preview-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="docx-preview-modal-header">
                            <div className="modal-title-group">
                                <FileText className="modal-docx-icon" size={18} />
                                <span className="modal-filename">{previewFile.name}</span>
                            </div>
                            
                            {/* Sticky Premium Reading Controls */}
                            <div className="modal-reading-controls">
                                <button className="control-btn-preview" onClick={() => setZoom(prev => Math.max(50, prev - 10))} title="Zoom Out">
                                    <ZoomOut size={14} />
                                </button>
                                <span className="zoom-level-text">{zoom}%</span>
                                <button className="control-btn-preview" onClick={() => setZoom(prev => Math.min(200, prev + 10))} title="Zoom In">
                                    <ZoomIn size={14} />
                                </button>
                                <button className="control-btn-preview" onClick={() => setZoom(100)} title="Reset Zoom">
                                    100%
                                </button>
                                
                                <div className="control-divider" />
                                
                                <button 
                                    className={`theme-dot light ${paperTheme === 'light' ? 'active' : ''}`} 
                                    onClick={() => setPaperTheme('light')} 
                                    title="Light Theme" 
                                />
                                <button 
                                    className={`theme-dot sepia ${paperTheme === 'sepia' ? 'active' : ''}`} 
                                    onClick={() => setPaperTheme('sepia')} 
                                    title="Sepia Theme" 
                                />
                                <button 
                                    className={`theme-dot dark ${paperTheme === 'dark' ? 'active' : ''}`} 
                                    onClick={() => setPaperTheme('dark')} 
                                    title="Dark Theme" 
                                />
                                
                                <div className="control-divider" />
                                
                                <button 
                                    className="control-btn-preview" 
                                    onClick={() => {
                                        const content = previewContainerRef.current?.innerHTML;
                                        if (!content) return;
                                        const printWindow = window.open('', '_blank');
                                        printWindow.document.write(`
                                            <html>
                                                <head>
                                                    <title>${previewFile.name}</title>
                                                    <style>
                                                        body {
                                                            font-family: Calibri, Arial, sans-serif;
                                                            padding: 40px;
                                                            color: #2D3748;
                                                        }
                                                        table {
                                                            border-collapse: collapse;
                                                            width: 100%;
                                                            margin: 16px 0;
                                                        }
                                                        th, td {
                                                            border: 1px solid #D2D6DC;
                                                            padding: 8px 12px;
                                                        }
                                                        th {
                                                            background-color: #1A365D;
                                                            color: white;
                                                            font-weight: bold;
                                                        }
                                                    </style>
                                                </head>
                                                <body onload="window.print(); window.close();">
                                                    ${content}
                                                </body>
                                            </html>
                                        `);
                                        printWindow.document.close();
                                    }} 
                                    title="Print Document"
                                >
                                    <Printer size={14} />
                                </button>
                            </div>

                            <div className="modal-header-actions">
                                <a href={previewFile.url} download className="modal-btn" title="Download Document">
                                    <Download size={16} />
                                </a>
                                <button className="modal-btn close-btn" onClick={() => { setPreviewFile(null); setZoom(100); setPaperTheme('light'); }} title="Close Preview">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className={`docx-preview-modal-body paper-theme-${paperTheme}`}>
                            {loadingPreview && (
                                <div className="modal-loading-overlay">
                                    <RefreshCw className="modal-loading-spinner spin" size={24} />
                                    <span className="modal-loading-text">Loading document preview...</span>
                                </div>
                            )}
                            <div className="docx-viewer-output-wrapper" style={{ width: `${800 * (zoom / 100)}px`, maxWidth: '100%' }}>
                                <div ref={previewContainerRef}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatPage;
