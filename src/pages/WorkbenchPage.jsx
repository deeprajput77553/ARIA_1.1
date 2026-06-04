import { useState, useEffect, useRef } from 'react';
import { 
    Folder, File, Database, Play, Save, Plus, Trash2, 
    Terminal, Activity, FileText, Image, Search, 
    Code, Info, AlertCircle, CheckCircle2, 
    Network, Shield, Edit3, X, RefreshCw, Download, ZoomIn
} from 'lucide-react';
import PipelineVisualizer from '../components/PipelineVisualizer';

function WorkbenchPage({ pipelineState, connected, workspaceDir, profile, logs, wsRef }) {
    const [activeTab, setActiveTab] = useState('explorer');
    
    // --- Explorer State ---
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [editContent, setEditContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loadingFile, setLoadingFile] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // { success, message }
    
    // Create new file/folder modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [newFileType, setNewFileType] = useState('file'); // 'file' | 'dir'
    const [createStatus, setCreateStatus] = useState(null);

    // Preview
    const docxContainerRef = useRef(null);

    // --- Memory Facts State ---
    const [facts, setFacts] = useState(profile?.known_facts || []);
    const [newFact, setNewFact] = useState('');
    const [editingFactIndex, setEditingFactIndex] = useState(-1);
    const [editingFactText, setEditingFactText] = useState('');
    
    // --- Plugin Executor State ---
    const [pluginsList, setPluginsList] = useState(() => window.aria_synced_plugins || []);
    const [selectedPlugin, setSelectedPlugin] = useState(() => {
        const list = window.aria_synced_plugins || [];
        return list.length > 0 ? list[0].name : '';
    });
    const [pluginParams, setPluginParams] = useState({});
    const [toolRunning, setToolRunning] = useState(false);
    const [toolResult, setToolResult] = useState('');
    const [generatedImgPath, setGeneratedImgPath] = useState(null);
    const [showZoomImage, setShowZoomImage] = useState(false);

    // --- Logs State ---
    const [logFilter, setLogFilter] = useState('all');
    const [logSearch, setLogSearch] = useState('');

    // --- 1. WebSocket Event Integration ---
    useEffect(() => {
        // Sync facts when profile updates
        if (profile?.known_facts) {
            const newFacts = profile.known_facts;
            setTimeout(() => {
                setFacts(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(newFacts)) return prev;
                    return newFacts;
                });
            }, 0);
        }
    }, [profile]);

    // Request files on mount or reconnect
    useEffect(() => {
        if (connected && wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'workbench:list_files' }));
        }
    }, [connected, wsRef]);

    useEffect(() => {
        const handleFilesList = (e) => {
            setFiles(e.detail || []);
        };

        const handleSaveDone = (e) => {
            const res = e.detail;
            if (res.success) {
                setSaveStatus({ success: true, message: 'File saved successfully!' });
                setIsEditing(false);
                setFileContent(editContent);
            } else {
                setSaveStatus({ success: false, message: `Save failed: ${res.error}` });
            }
            setTimeout(() => setSaveStatus(null), 3000);
        };

        const handleCreateDone = (e) => {
            const res = e.detail;
            if (res.success) {
                setCreateStatus({ success: true, message: 'Item created!' });
                setNewFileName('');
                setTimeout(() => {
                    setShowCreateModal(false);
                    setCreateStatus(null);
                }, 1000);
            } else {
                setCreateStatus({ success: false, message: res.error });
            }
        };

        const handleExecuteDone = (e) => {
            const res = e.detail;
            setToolRunning(false);
            if (res.success) {
                setToolResult(res.result);
                // Check if generate_image ran and extract filename
                if (res.name === 'generate_image') {
                    const match = res.result.match(/Saved to:\s*`?images\/([a-zA-Z0-9_\-.]+)/i);
                    if (match && match[1]) {
                        setGeneratedImgPath(`images/${match[1]}`);
                    }
                }
            } else {
                setToolResult(`[Error executing plugin]: ${res.error}`);
            }
        };

        window.addEventListener('workbench:files_list', handleFilesList);
        window.addEventListener('workbench:save_done', handleSaveDone);
        window.addEventListener('workbench:create_done', handleCreateDone);
        window.addEventListener('workbench:execute_done', handleExecuteDone);

        // Fetch plugins schema if already synced in parent
        // App.jsx will dispatch custom event on system:sync
        const handleSystemSync = (e) => {
            if (e.detail?.plugins) {
                setPluginsList(e.detail.plugins);
                if (e.detail.plugins.length > 0 && !selectedPlugin) {
                    setSelectedPlugin(e.detail.plugins[0].name);
                }
            }
        };
        window.addEventListener('system:sync_data', handleSystemSync);

        return () => {
            window.removeEventListener('workbench:files_list', handleFilesList);
            window.removeEventListener('workbench:save_done', handleSaveDone);
            window.removeEventListener('workbench:create_done', handleCreateDone);
            window.removeEventListener('workbench:execute_done', handleExecuteDone);
            window.removeEventListener('system:sync_data', handleSystemSync);
        };
    }, [editContent, selectedPlugin]);

    // Handle initial list sync fallback
    // Initial sync is done in useState initializer; system:sync listener handles dynamic updates.

    // --- 2. File Loading Logic ---
    const handleSelectFile = async (file) => {
        if (file.isDir) return;
        
        setSelectedFile(file);
        setLoadingFile(true);
        setIsEditing(false);
        setSaveStatus(null);
        
        const ext = file.path.split('.').pop().toLowerCase();
        
        try {
            // Fetch using the `/workspace/` server HTTP endpoint
            const isDev = window.location.hostname === 'localhost' && window.location.port !== '4200';
            const serverUrl = isDev ? 'http://localhost:4200' : '';
            const fileUrl = `${serverUrl}/workspace/${encodeURIComponent(file.path)}`;
            
            if (ext === 'docx') {
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                
                setFileContent('[Binary Word Document Preview]');
                
                // Render docx after loading state finishes
                setTimeout(async () => {
                    if (docxContainerRef.current) {
                        docxContainerRef.current.innerHTML = '';
                        try {
                            const docx = await import('docx-preview');
                            await docx.renderAsync(arrayBuffer, docxContainerRef.current, null, {
                                className: "docx-preview-container",
                                inWrapper: false
                            });
                        } catch (err) {
                            console.error("Failed to render docx:", err);
                            if (docxContainerRef.current) {
                                docxContainerRef.current.innerHTML = `<div class="error-panel"><p>Failed to render DOCX preview dynamically: ${err.message}</p></div>`;
                            }
                        }
                    }
                }, 100);
            } else {
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                const text = await response.text();
                setFileContent(text);
                setEditContent(text);
            }
        } catch (err) {
            console.error("Error reading file:", err);
            setFileContent(`[Error reading file contents]: ${err.message}`);
        } finally {
            setLoadingFile(false);
        }
    };

    const handleSaveFile = () => {
        if (!selectedFile || !connected) return;
        wsRef.current.send(JSON.stringify({
            type: 'workbench:save_file',
            path: selectedFile.path,
            content: editContent
        }));
    };

    const handleCreateItem = (e) => {
        e.preventDefault();
        if (!newFileName.trim() || !connected) return;
        wsRef.current.send(JSON.stringify({
            type: 'workbench:create_file',
            path: newFileName.trim(),
            isDir: newFileType === 'dir'
        }));
    };

    const handleDeleteFile = (filePath) => {
        if (!connected) return;
        if (confirm(`Are you sure you want to permanently delete: "${filePath}"?`)) {
            wsRef.current.send(JSON.stringify({
                type: 'workbench:delete_file',
                path: filePath
            }));
            if (selectedFile?.path === filePath) {
                setSelectedFile(null);
                setFileContent('');
            }
        }
    };

    // --- 3. Memory Fact Logic ---
    const handleAddFact = (e) => {
        e.preventDefault();
        if (!newFact.trim() || !connected) return;
        const updatedFacts = [...facts, newFact.trim()];
        setFacts(updatedFacts);
        setNewFact('');
        
        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: {
                ...profile,
                known_facts: updatedFacts
            }
        }));
    };

    const handleSaveEditFact = (index) => {
        if (!editingFactText.trim() || !connected) return;
        const updatedFacts = [...facts];
        const oldFact = updatedFacts[index];
        if (typeof oldFact === 'object' && oldFact !== null) {
            updatedFacts[index] = { ...oldFact, text: editingFactText.trim() };
        } else {
            updatedFacts[index] = editingFactText.trim();
        }
        setFacts(updatedFacts);
        setEditingFactIndex(-1);

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: {
                ...profile,
                known_facts: updatedFacts
            }
        }));
    };

    const handleDeleteFact = (index) => {
        if (!connected) return;
        const updatedFacts = facts.filter((_, idx) => idx !== index);
        setFacts(updatedFacts);
        
        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: {
                ...profile,
                known_facts: updatedFacts
            }
        }));
    };

    // --- 3b. User Data Profile Attributes Logic ---
    const [newUserDataKey, setNewUserDataKey] = useState('');
    const [newUserDataVal, setNewUserDataVal] = useState('');
    const [editingUserDataKey, setEditingUserDataKey] = useState('');
    const [editingUserDataVal, setEditingUserDataVal] = useState('');

    const handleAddUserData = (e) => {
        e.preventDefault();
        const key = newUserDataKey.trim();
        const val = newUserDataVal.trim();
        if (!key || !val || !connected) return;

        let parsedVal = val;
        if (val.startsWith('[') || val.startsWith('{')) {
            try { parsedVal = JSON.parse(val); } catch (err) {}
        }

        const updatedProfile = {
            ...profile,
            [key]: parsedVal
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setNewUserDataKey('');
        setNewUserDataVal('');
    };

    const handleSaveEditUserData = (key) => {
        if (!editingUserDataVal.trim() || !connected) return;
        let parsedVal = editingUserDataVal.trim();
        if (parsedVal.startsWith('[') || parsedVal.startsWith('{')) {
            try { parsedVal = JSON.parse(parsedVal); } catch (err) {}
        }

        const updatedProfile = {
            ...profile,
            [key]: parsedVal
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setEditingUserDataKey('');
        setEditingUserDataVal('');
    };

    const handleDeleteUserData = (key) => {
        if (!connected) return;
        if (confirm(`Are you sure you want to delete profile property: "${key}"?`)) {
            const updatedProfile = { ...profile };
            delete updatedProfile[key];

            wsRef.current.send(JSON.stringify({
                type: 'settings:update_profile',
                profile: updatedProfile
            }));
        }
    };

    // --- 3c. Agent Models Configurations Logic ---
    const [newAgentKey, setNewAgentKey] = useState('');
    const [newAgentVal, setNewAgentVal] = useState('');
    const [editingAgentKey, setEditingAgentKey] = useState('');
    const [editingAgentVal, setEditingAgentVal] = useState('');

    const handleAddAgentModel = (e) => {
        e.preventDefault();
        const key = newAgentKey.trim().toUpperCase();
        const val = newAgentVal.trim();
        if (!key || !val || !connected) return;

        const updatedAgentModels = {
            ...(profile.agent_models || {}),
            [key]: val
        };

        const updatedProfile = {
            ...profile,
            agent_models: updatedAgentModels
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setNewAgentKey('');
        setNewAgentVal('');
    };

    const handleSaveEditAgentModel = (key) => {
        if (!editingAgentVal.trim() || !connected) return;
        
        const updatedAgentModels = {
            ...(profile.agent_models || {}),
            [key]: editingAgentVal.trim()
        };

        const updatedProfile = {
            ...profile,
            agent_models: updatedAgentModels
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setEditingAgentKey('');
        setEditingAgentVal('');
    };

    const handleDeleteAgentModel = (key) => {
        if (!connected) return;
        if (confirm(`Are you sure you want to delete agent model stage: "${key}"?`)) {
            const updatedAgentModels = { ...(profile.agent_models || {}) };
            delete updatedAgentModels[key];

            const updatedProfile = {
                ...profile,
                agent_models: updatedAgentModels
            };

            wsRef.current.send(JSON.stringify({
                type: 'settings:update_profile',
                profile: updatedProfile
            }));
        }
    };

    // --- 4. Tool Execution Logic ---
    const activePlugin = pluginsList.find(p => p.name === selectedPlugin);

    const handleParamChange = (name, val) => {
        setPluginParams(prev => ({
            ...prev,
            [name]: val
        }));
    };

    const handleExecuteTool = () => {
        if (!selectedPlugin || !connected) return;
        setToolRunning(true);
        setToolResult('Executing plugin on backend...');
        setGeneratedImgPath(null);

        // Sanitize parameters (convert types based on schema)
        const schema = activePlugin?.schema || {};
        const sanitized = {};
        for (const [key, rules] of Object.entries(schema)) {
            let val = pluginParams[key];
            if (val === undefined) {
                val = '';
            }
            if (rules.type === 'number') {
                sanitized[key] = parseFloat(val) || 0;
            } else if (rules.type === 'boolean') {
                sanitized[key] = val === true || val === 'true';
            } else {
                sanitized[key] = String(val);
            }
        }

        wsRef.current.send(JSON.stringify({
            type: 'workbench:execute_tool',
            name: selectedPlugin,
            params: sanitized
        }));
    };

    // --- 5. Logs Filters ---
    const filteredLogs = logs.filter(l => {
        const matchesLevel = logFilter === 'all' || 
            (logFilter === 'info' && (l.level === 'info' || l.level === 'success')) ||
            (logFilter === 'error' && (l.level === 'error' || l.level === 'warn')) ||
            (logFilter === 'debug' && (l.level === 'debug' || l.level === 'stage'));
            
        const matchesSearch = !logSearch || 
            l.message.toLowerCase().includes(logSearch.toLowerCase()) ||
            l.level.toLowerCase().includes(logSearch.toLowerCase());
            
        return matchesLevel && matchesSearch;
    });

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (filePath) => {
        const ext = filePath.split('.').pop().toLowerCase();
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') return <Image size={15} className="text-purple" />;
        if (ext === 'docx') return <FileText size={15} className="text-blue" />;
        if (ext === 'md') return <FileText size={15} className="text-cyan" />;
        if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx' || ext === 'html' || ext === 'css') return <Code size={15} className="text-green" />;
        return <File size={15} className="text-slate" />;
    };

    const renderLineInline = (str) => {
        const regex = /(!\[.*?\]\(.*?\))|(\[.*?\]\(.*?\))|(\*\*.*?\*\*)|(\`.*?\`)/g;
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
        if (!text) return '';
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
        <div className="workbench-page-container">
            <header className="page-section-header">
                <div className="header-title-row">
                    <h2 className="page-title">Developer Studio & Workbench</h2>
                    <span className={`status-pill ${connected ? 'live' : 'offline'}`}>
                        {connected ? 'CONNECTED (LIVE)' : 'OFFLINE (RECONNECTING)'}
                    </span>
                </div>
                <p className="page-subtitle">File system editor, AI profile facts editor, interactive plugin tester, and live log diagnostics.</p>
            </header>

            {/* --- Workbench Tabs --- */}
            <div className="workbench-tab-row">
                <button 
                    className={`workbench-tab ${activeTab === 'explorer' ? 'active' : ''}`}
                    onClick={() => setActiveTab('explorer')}
                >
                    <Folder size={16} /> File Explorer & Editor
                </button>
                <button 
                    className={`workbench-tab ${activeTab === 'memory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('memory')}
                >
                    <Database size={16} /> AI Memory Console ({facts.length})
                </button>
                <button 
                    className={`workbench-tab ${activeTab === 'tools' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tools')}
                >
                    <Play size={16} /> Plugin Workbench
                </button>
                <button 
                    className={`workbench-tab ${activeTab === 'diagnostics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('diagnostics')}
                >
                    <Activity size={16} /> Telemetry & Pipeline
                </button>
                <button 
                    className={`workbench-tab ${activeTab === 'logs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('logs')}
                >
                    <Terminal size={16} /> Live Logs ({filteredLogs.length})
                </button>
            </div>

            {/* --- TAB PANELS --- */}
            <div className="workbench-content-viewport">
                
                {/* 1. FILE EXPLORER TAB */}
                {activeTab === 'explorer' && (
                    <div className="workbench-explorer-layout">
                        <div className="explorer-left-sidebar">
                            <div className="sidebar-header">
                                <span className="section-title-mini">Workspace Files</span>
                                <button className="create-item-btn" onClick={() => setShowCreateModal(true)} disabled={!connected}>
                                    <Plus size={14} /> New
                                </button>
                            </div>
                            <div className="explorer-file-tree">
                                {files.length === 0 ? (
                                    <div className="tree-loading">
                                        <RefreshCw size={14} className="spin text-blue" />
                                        <span>No files loaded...</span>
                                    </div>
                                ) : (
                                    files.map((file, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`file-tree-item ${file.isDir ? 'dir' : 'file'} ${selectedFile?.path === file.path ? 'selected' : ''}`}
                                            onClick={() => handleSelectFile(file)}
                                            style={{ paddingLeft: `${file.path.split('/').length * 8}px` }}
                                        >
                                            {file.isDir ? <Folder size={15} className="text-yellow" /> : getFileIcon(file.name)}
                                            <span className="file-item-name" title={file.path}>{file.name}</span>
                                            {!file.isDir && <span className="file-item-size">{formatBytes(file.size)}</span>}
                                            <button 
                                                className="file-delete-btn" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFile(file.path);
                                                }}
                                                disabled={!connected}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="explorer-right-panel">
                            {selectedFile ? (
                                <div className="editor-outer-container">
                                    <div className="editor-header">
                                        <div className="editor-file-info">
                                            {getFileIcon(selectedFile.name)}
                                            <span className="editor-file-path">{selectedFile.path}</span>
                                            {selectedFile.path.split('.').pop() === 'docx' && (
                                                <span className="docx-indicator-badge">DOCX Preview Mode</span>
                                            )}
                                        </div>
                                        <div className="editor-actions">
                                            {selectedFile.path.split('.').pop() !== 'docx' && (
                                                <>
                                                    {!isEditing ? (
                                                        <button className="editor-btn primary" onClick={() => { setIsEditing(true); setEditContent(fileContent); }}>
                                                            <Edit3 size={14} /> Edit Code
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button className="editor-btn success" onClick={handleSaveFile} disabled={!connected}>
                                                                <Save size={14} /> Save File
                                                            </button>
                                                            <button className="editor-btn danger" onClick={() => setIsEditing(false)}>
                                                                <X size={14} /> Cancel
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {saveStatus && (
                                        <div className={`editor-alert-banner ${saveStatus.success ? 'success' : 'error'}`}>
                                            {saveStatus.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                            <span>{saveStatus.message}</span>
                                        </div>
                                    )}

                                    <div className="editor-body">
                                        {loadingFile ? (
                                            <div className="editor-loading">
                                                <RefreshCw size={24} className="spin text-blue" />
                                                <span>Loading file contents...</span>
                                            </div>
                                        ) : selectedFile.path.split('.').pop() === 'docx' ? (
                                            <div className="docx-render-viewport">
                                                <div className="docx-render-scroll" ref={docxContainerRef}>
                                                    {/* docx-preview renders here */}
                                                </div>
                                            </div>
                                        ) : isEditing ? (
                                            <textarea 
                                                className="code-textarea"
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                            />
                                        ) : (
                                            <pre className="code-viewer">
                                                <code>{fileContent}</code>
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="editor-placeholder">
                                    <FileText size={40} className="text-slate" />
                                    <h3>No File Selected</h3>
                                    <p>Select a code file, markdown doc, or Word document (.docx) from the tree to view and edit.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. AI MEMORY FACTS TAB */}
                {activeTab === 'memory' && (
                    <div className="workbench-memory-layout-custom">
                        {/* Section 1: Facts / Semantic Memory */}
                        <div className="memory-section-card">
                            <h3 className="section-title"><Database size={16} /> Persistent Fact Database</h3>
                            <p className="section-desc">Aria extracts key facts about you during conversations. Manage or correct these statements below.</p>
                            
                            <form onSubmit={handleAddFact} className="memory-add-form">
                                <input 
                                    type="text" 
                                    className="memory-add-input"
                                    placeholder="Enter a new statement..."
                                    value={newFact}
                                    onChange={(e) => setNewFact(e.target.value)}
                                    required
                                    disabled={!connected}
                                />
                                <button type="submit" className="memory-add-btn" disabled={!newFact.trim() || !connected}>
                                    <Plus size={14} /> Add
                                </button>
                            </form>

                            <div className="memory-facts-list">
                                {facts.length === 0 ? (
                                    <div className="facts-placeholder">
                                        <Info size={18} className="text-slate" />
                                        <span>No facts stored yet. Stored statements will appear here.</span>
                                    </div>
                                ) : (
                                    facts.map((fact, idx) => {
                                        const displayFactText = typeof fact === 'object' && fact !== null ? fact.text || JSON.stringify(fact) : fact;
                                        return (
                                            <div key={idx} className="fact-item-card">
                                                {editingFactIndex === idx ? (
                                                    <div className="fact-edit-row">
                                                        <input 
                                                            type="text" 
                                                            className="fact-edit-input" 
                                                            value={editingFactText}
                                                            onChange={(e) => setEditingFactText(e.target.value)}
                                                        />
                                                        <div className="fact-edit-actions">
                                                            <button className="fact-action-btn success" onClick={() => handleSaveEditFact(idx)}>
                                                                Save
                                                            </button>
                                                            <button className="fact-action-btn cancel" onClick={() => setEditingFactIndex(-1)}>
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="fact-number">#{idx + 1}</span>
                                                        <p className="fact-content-text">{displayFactText}</p>
                                                        <div className="fact-item-actions">
                                                            <button className="fact-icon-btn edit" onClick={() => { setEditingFactIndex(idx); setEditingFactText(displayFactText); }}>
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button className="fact-icon-btn delete" onClick={() => handleDeleteFact(idx)}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Section 2: User Data Profile Attributes */}
                        <div className="memory-section-card">
                            <h3 className="section-title"><Shield size={16} /> User Data Profile</h3>
                            <p className="section-desc">View and manage persistent user properties stored in user_data.json.</p>
                            
                            <form onSubmit={handleAddUserData} className="memory-add-form-kv">
                                <input 
                                    type="text" 
                                    placeholder="Key (e.g. city)" 
                                    className="memory-add-input"
                                    value={newUserDataKey}
                                    onChange={(e) => setNewUserDataKey(e.target.value)}
                                    required
                                />
                                <input 
                                    type="text" 
                                    placeholder="Value" 
                                    className="memory-add-input"
                                    value={newUserDataVal}
                                    onChange={(e) => setNewUserDataVal(e.target.value)}
                                    required
                                />
                                <button type="submit" className="memory-add-btn" disabled={!newUserDataKey.trim() || !newUserDataVal.trim() || !connected}>
                                    <Plus size={14} /> Add
                                </button>
                            </form>

                            <div className="memory-facts-list">
                                {Object.entries(profile || {})
                                    .filter(([key]) => key !== 'known_facts' && key !== 'agent_models')
                                    .map(([key, val]) => {
                                        const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                                        const isSystemKey = ['user_name', 'operating_system', 'preferred_programming_languages', 'preferences', 'workspace_dir'].includes(key);
                                        return (
                                            <div key={key} className="fact-item-card kv-card">
                                                {editingUserDataKey === key ? (
                                                    <div className="fact-edit-row">
                                                        <span className="fact-kv-key-label" title={key}>{key}</span>
                                                        <input 
                                                            type="text" 
                                                            className="fact-edit-input" 
                                                            value={editingUserDataVal}
                                                            onChange={(e) => setEditingUserDataVal(e.target.value)}
                                                        />
                                                        <div className="fact-edit-actions">
                                                            <button className="fact-action-btn success" onClick={() => handleSaveEditUserData(key)}>
                                                                Save
                                                            </button>
                                                            <button className="fact-action-btn cancel" onClick={() => setEditingUserDataKey('')}>
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="fact-kv-details">
                                                            <span className="fact-kv-key" title={key}>{key}</span>
                                                            <span className="fact-kv-value" title={displayVal}>{displayVal}</span>
                                                        </div>
                                                        <div className="fact-item-actions">
                                                            <button className="fact-icon-btn edit" onClick={() => { setEditingUserDataKey(key); setEditingUserDataVal(displayVal); }}>
                                                                    <Edit3 size={14} />
                                                            </button>
                                                            {!isSystemKey && (
                                                                <button className="fact-icon-btn delete" onClick={() => handleDeleteUserData(key)}>
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>

                        {/* Section 3: Agent Data Configuration */}
                        <div className="memory-section-card">
                            <h3 className="section-title"><Network size={16} /> Agent Pipeline Models</h3>
                            <p className="section-desc">View and manage model configurations assigned to pipeline stages.</p>
                            
                            <form onSubmit={handleAddAgentModel} className="memory-add-form-kv">
                                <input 
                                    type="text" 
                                    placeholder="STAGE (e.g. SUMMARY)" 
                                    className="memory-add-input uppercase"
                                    value={newAgentKey}
                                    onChange={(e) => setNewAgentKey(e.target.value)}
                                    required
                                />
                                <input 
                                    type="text" 
                                    placeholder="Ollama Model" 
                                    className="memory-add-input"
                                    value={newAgentVal}
                                    onChange={(e) => setNewAgentVal(e.target.value)}
                                    required
                                />
                                <button type="submit" className="memory-add-btn" disabled={!newAgentKey.trim() || !newAgentVal.trim() || !connected}>
                                    <Plus size={14} /> Add
                                </button>
                            </form>

                            <div className="memory-facts-list">
                                {Object.entries(profile?.agent_models || {})
                                    .map(([key, val]) => {
                                        const displayVal = String(val);
                                        const isSystemKey = ['ROUTER', 'REACTIVE', 'COMPLEX', 'VERIFY'].includes(key);
                                        return (
                                            <div key={key} className="fact-item-card kv-card">
                                                {editingAgentKey === key ? (
                                                    <div className="fact-edit-row">
                                                        <span className="fact-kv-key-label" title={key}>{key}</span>
                                                        <input 
                                                            type="text" 
                                                            className="fact-edit-input" 
                                                            value={editingAgentVal}
                                                            onChange={(e) => setEditingAgentVal(e.target.value)}
                                                        />
                                                        <div className="fact-edit-actions">
                                                            <button className="fact-action-btn success" onClick={() => handleSaveEditAgentModel(key)}>
                                                                Save
                                                            </button>
                                                            <button className="fact-action-btn cancel" onClick={() => setEditingAgentKey('')}>
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="fact-kv-details">
                                                            <span className="fact-kv-key text-cyan" title={key}>{key}</span>
                                                            <span className="fact-kv-value" title={displayVal}>{displayVal}</span>
                                                        </div>
                                                        <div className="fact-item-actions">
                                                            <button className="fact-icon-btn edit" onClick={() => { setEditingAgentKey(key); setEditingAgentVal(displayVal); }}>
                                                                    <Edit3 size={14} />
                                                            </button>
                                                            {!isSystemKey && (
                                                                <button className="fact-icon-btn delete" onClick={() => handleDeleteAgentModel(key)}>
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. PLUGIN TEST WORKBENCH TAB */}
                {activeTab === 'tools' && (
                    <div className="workbench-tools-layout">
                        <div className="tools-sidebar-params">
                            <h3 className="section-title"><Play size={16} /> Execute Backend Plugins</h3>
                            <p className="section-desc">Run server plugins manually outside of the conversational pipeline flow. Specify inputs to debug results directly.</p>

                            <div className="form-group mt-16">
                                <label className="form-label">Select Plugin Tool</label>
                                <select 
                                    className="form-input"
                                    value={selectedPlugin}
                                    onChange={(e) => {
                                        setSelectedPlugin(e.target.value);
                                        setPluginParams({});
                                        setToolResult('');
                                        setGeneratedImgPath(null);
                                    }}
                                >
                                    {pluginsList.length === 0 ? (
                                        <option value="">No plugins synchronized</option>
                                    ) : (
                                        pluginsList.map(p => (
                                            <option key={p.name} value={p.name}>{p.name}</option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {activePlugin && (
                                <div className="plugin-description-panel">
                                    <Info size={14} />
                                    <span>{activePlugin.description}</span>
                                </div>
                            )}

                            {activePlugin && activePlugin.schema && (
                                <div className="plugin-params-form mt-16">
                                    <span className="section-title-mini">Parameters Form</span>
                                    {Object.entries(activePlugin.schema).map(([key, rules]) => (
                                        <div className="form-group" key={key}>
                                            <label className="form-label">
                                                {key} {rules.required && <span className="text-red">*</span>}
                                            </label>
                                            
                                            {rules.type === 'boolean' ? (
                                                <select 
                                                    className="form-input"
                                                    value={pluginParams[key] || 'false'}
                                                    onChange={(e) => handleParamChange(key, e.target.value === 'true')}
                                                >
                                                    <option value="false">False</option>
                                                    <option value="true">True</option>
                                                </select>
                                            ) : key === 'prompt' || key === 'args' || rules.description.includes('description') ? (
                                                <textarea 
                                                    className="form-input text-area"
                                                    placeholder={rules.description}
                                                    value={pluginParams[key] || ''}
                                                    onChange={(e) => handleParamChange(key, e.target.value)}
                                                    required={rules.required}
                                                />
                                            ) : (
                                                <input 
                                                    type={rules.type === 'number' ? 'number' : 'text'}
                                                    className="form-input"
                                                    placeholder={rules.description}
                                                    value={pluginParams[key] || ''}
                                                    onChange={(e) => handleParamChange(key, e.target.value)}
                                                    required={rules.required}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button 
                                className="execute-tool-btn mt-16"
                                onClick={handleExecuteTool}
                                disabled={toolRunning || !selectedPlugin || !connected}
                            >
                                {toolRunning ? (
                                    <>
                                        <RefreshCw size={14} className="spin" /> Executing plugin...
                                    </>
                                ) : (
                                    <>
                                        <Play size={14} /> Run Plugin Tool
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="tools-console-panel">
                            <div className="console-header">
                                <span className="console-title"><Terminal size={14} /> Console Output Log</span>
                                <button className="console-clear-btn" onClick={() => { setToolResult(''); setGeneratedImgPath(null); }}>
                                    Clear Console
                                </button>
                            </div>
                            <div className="console-body" style={{ overflowY: 'auto', maxHeight: '550px' }}>
                                {toolResult ? (
                                    <div className="console-output-rich">
                                        {parseMarkdownToReact(toolResult)}
                                    </div>
                                ) : (
                                    <div className="console-empty">
                                        <Terminal size={32} className="text-slate" />
                                        <span>Terminal is idle. Trigger a plugin execution on the left to see debug outputs.</span>
                                    </div>
                                )}

                                {/* Real-time rendering of generated image file if generate_image was run! */}
                                {generatedImgPath && (
                                    <div className="console-image-card">
                                        <div className="image-card-header">
                                            <span className="image-card-title"><Image size={14} /> Generated Graphic Visualizer</span>
                                            <div className="image-card-actions">
                                                <button className="image-action-btn" onClick={() => setShowZoomImage(true)}>
                                                    <ZoomIn size={14} /> Inspect
                                                </button>
                                                <a 
                                                    href={(() => {
                                                        const isDev = window.location.hostname === 'localhost' && window.location.port !== '4200';
                                                        const serverUrl = isDev ? 'http://localhost:4200' : '';
                                                        return `${serverUrl}/workspace/${encodeURIComponent(generatedImgPath)}`;
                                                    })()} 
                                                    download 
                                                    className="image-action-btn download"
                                                >
                                                    <Download size={14} /> Save
                                                </a>
                                            </div>
                                        </div>
                                        <div className="image-card-preview-viewport">
                                            <img 
                                                src={(() => {
                                                    const isDev = window.location.hostname === 'localhost' && window.location.port !== '4200';
                                                    const serverUrl = isDev ? 'http://localhost:4200' : '';
                                                    return `${serverUrl}/workspace/${encodeURIComponent(generatedImgPath)}`;
                                                })()}
                                                alt="Plugin generated graph" 
                                                className="generated-preview-image"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. TELEMETRY & PIPELINE TAB */}
                {activeTab === 'diagnostics' && (
                    <div className="workbench-telemetry-layout">
                        <div className="telemetry-top-row">
                            <PipelineVisualizer pipelineState={pipelineState} />
                        </div>
                        
                        <div className="telemetry-details-grid">
                            <div className="system-status-card">
                                <h3 className="section-title"><Network size={16} /> Active Websocket Status</h3>
                                <div className="topology-list">
                                    <div className="topology-item">
                                        <span className="topo-label">WebSocket Host:</span>
                                        <span className="topo-value">ws://localhost:4200</span>
                                    </div>
                                    <div className="topology-item">
                                        <span className="topo-label">Client Handshake:</span>
                                        <span className="topo-value text-green">101 Switching Protocols</span>
                                    </div>
                                    <div className="topology-item">
                                        <span className="topo-label">Status Connection:</span>
                                        <span className={`topo-value ${connected ? 'text-green' : 'text-red'}`}>
                                            {connected ? 'CONNECTED (LIVE)' : 'OFFLINE (RECONNECTING)'}
                                        </span>
                                    </div>
                                    <div className="topology-item">
                                        <span className="topo-label">Workspace Folder:</span>
                                        <span className="topo-value" title={workspaceDir}>{workspaceDir || 'Loading...'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="system-status-card">
                                <h3 className="section-title"><Shield size={16} /> Security & Ollama Configs</h3>
                                <div className="topology-list">
                                    <div className="topology-item">
                                        <span className="topo-label">Safe Paths Sandbox:</span>
                                        <span className="topo-value text-green">Active (Isolation Enabled)</span>
                                    </div>
                                    <div className="topology-item">
                                        <span className="topo-label">Ollama API Endpoint:</span>
                                        <span className="topo-value">http://127.0.0.1:11434</span>
                                    </div>
                                    <div className="topology-item">
                                        <span className="topo-label">Router Model:</span>
                                        <span className="topo-value">llama3.2:1b</span>
                                    </div>
                                    <div className="topology-item">
                                        <span className="topo-label">Complex Planner:</span>
                                        <span className="topo-value">qwen2.5-coder:7b</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. LIVE LOGS TAB */}
                {activeTab === 'logs' && (
                    <div className="workbench-logs-layout">
                        <div className="logs-header-toolbar">
                            <div className="search-bar">
                                <Search size={14} className="search-icon" />
                                <input 
                                    type="text" 
                                    className="search-input" 
                                    placeholder="Search logs contents..."
                                    value={logSearch}
                                    onChange={(e) => setLogSearch(e.target.value)}
                                />
                            </div>
                            <div className="logs-filters">
                                <button className={`log-filter-btn ${logFilter === 'all' ? 'active' : ''}`} onClick={() => setLogFilter('all')}>
                                    All ({logs.length})
                                </button>
                                <button className={`log-filter-btn info ${logFilter === 'info' ? 'active' : ''}`} onClick={() => setLogFilter('info')}>
                                    Info & Success
                                </button>
                                <button className={`log-filter-btn error ${logFilter === 'error' ? 'active' : ''}`} onClick={() => setLogFilter('error')}>
                                    Errors & Warnings
                                </button>
                                <button className={`log-filter-btn debug ${logFilter === 'debug' ? 'active' : ''}`} onClick={() => setLogFilter('debug')}>
                                    Debug & Stages
                                </button>
                            </div>
                        </div>

                        <div className="logs-viewer-body">
                            {filteredLogs.length === 0 ? (
                                <div className="logs-empty">
                                    <Terminal size={32} className="text-slate" />
                                    <span>No matching log outputs found.</span>
                                </div>
                            ) : (
                                <div className="logs-scroller">
                                    {filteredLogs.map((log) => (
                                        <div key={log.id} className={`log-line-item level-${log.level}`}>
                                            <span className="log-time">[{log.time}]</span>
                                            <span className="log-level">[{log.level.toUpperCase()}]</span>
                                            <span className="log-text">{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* --- CREATE FILE/FOLDER MODAL --- */}
            {showCreateModal && (
                <div className="workbench-modal-overlay">
                    <div className="workbench-modal-content">
                        <div className="modal-header">
                            <h3>Create New Resource</h3>
                            <button className="modal-close-btn" onClick={() => { setShowCreateModal(false); setCreateStatus(null); }}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateItem}>
                            <div className="modal-body">
                                {createStatus && (
                                    <div className={`modal-alert-banner ${createStatus.success ? 'success' : 'error'}`}>
                                        <span>{createStatus.message}</span>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Resource Type</label>
                                    <div className="toggle-options">
                                        <button 
                                            type="button" 
                                            className={`toggle-option ${newFileType === 'file' ? 'active' : ''}`}
                                            onClick={() => setNewFileType('file')}
                                        >
                                            <File size={14} /> New File
                                        </button>
                                        <button 
                                            type="button" 
                                            className={`toggle-option ${newFileType === 'dir' ? 'active' : ''}`}
                                            onClick={() => setNewFileType('dir')}
                                        >
                                            <Folder size={14} /> New Folder
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Path (relative to workspace)</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder={newFileType === 'file' ? 'src/utils/math.js' : 'src/components'}
                                        value={newFileName}
                                        onChange={(e) => setNewFileName(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <span className="form-help">Ensure parent folders exist or the script will create them automatically.</span>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="editor-btn danger" onClick={() => { setShowCreateModal(false); setCreateStatus(null); }}>
                                    Cancel
                                </button>
                                <button type="submit" className="editor-btn success" disabled={!newFileName.trim() || !connected}>
                                    Create Resource
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- ZOOM IMAGE MODAL OVERLAY --- */}
            {showZoomImage && generatedImgPath && (
                <div className="zoom-image-overlay" onClick={() => setShowZoomImage(false)}>
                    <div className="zoom-image-container" onClick={(e) => e.stopPropagation()}>
                        <button className="zoom-close-btn" onClick={() => setShowZoomImage(false)}>
                            <X size={20} />
                        </button>
                        <img 
                            src={(() => {
                                const isDev = window.location.hostname === 'localhost' && window.location.port !== '4200';
                                const serverUrl = isDev ? 'http://localhost:4200' : '';
                                return `${serverUrl}/workspace/${encodeURIComponent(generatedImgPath)}`;
                            })()}
                            alt="Visualizer zoom view" 
                            className="zoomed-image"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkbenchPage;
