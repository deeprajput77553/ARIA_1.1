import { useEffect, useState, useRef } from 'react';
import Navbar from './components/Navbar';
import OrbPage from './pages/OrbPage';
import ChatPage from './pages/ChatPage';
import WorkbenchPage from './pages/WorkbenchPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import LogTerminal from './components/LogTerminal';
import './index.css';

if (typeof window !== 'undefined') {
    window.playUISound = () => {};
}

function App() {
    const [activePage, setActivePage] = useState('orb');
    const [orbSentPrompt, setOrbSentPrompt] = useState(false);
    const [connected, setConnected] = useState(false);
    const [logs, setLogs] = useState([]);
    const [workspaceDir, setWorkspaceDir] = useState('');
    const [profile, setProfile] = useState({
        user_name: 'Deep Rajput',
        operating_system: 'Windows',
        preferred_programming_languages: ['javascript', 'python'],
        preferences: { theme: 'dark' },
        known_facts: []
    });

    const [pipelineState, setPipelineState] = useState({
        input: { status: 'done', detail: 'Waiting...', badge: 'IDLE' },
        context: { status: '', detail: '-', badge: '-' },
        router: { status: '', detail: '-', badge: '-' },
        exec: { status: '', detail: '-', badge: '-' },
        reflect: { status: '', detail: '-', badge: '-' },
        output: { status: '', detail: '-', badge: '-' }
    });

    const [sessions, setSessions] = useState(() => {
        const saved = localStorage.getItem('aria_chat_sessions');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) { }
        }
        return [
            {
                id: 'welcome',
                title: 'Welcome Chat',
                messages: [
                    {
                        id: 'welcome',
                        sender: 'ai',
                        text: 'Hello! I am Aria, your local workflow AI agent. How can I assist you today?',
                        timestamp: new Date().toLocaleTimeString(),
                        pipeline: null
                    }
                ]
            }
        ];
    });

    const [activeSessionId, setActiveSessionId] = useState(() => {
        const saved = localStorage.getItem('aria_active_session_id');
        if (saved && sessions.some(s => s.id === saved)) return saved;
        return sessions[0].id;
    });

    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
    const messages = activeSession.messages;

    const setMessages = (update) => {
        setSessions(prev => {
            const updated = prev.map(s => {
                if (s.id === activeSessionId) {
                    const newMessages = typeof update === 'function' ? update(s.messages) : update;
                    let title = s.title;
                    if (s.title === 'Welcome Chat' || s.title === 'New Chat') {
                        const firstUserMsg = newMessages.find(m => m.sender === 'user');
                        if (firstUserMsg) {
                            title = firstUserMsg.text.slice(0, 24) + (firstUserMsg.text.length > 24 ? '...' : '');
                        }
                    }
                    return {
                        ...s,
                        title,
                        messages: newMessages
                    };
                }
                return s;
            });
            localStorage.setItem('aria_chat_sessions', JSON.stringify(updated));
            return updated;
        });
    };

    const createNewSession = () => {
        const newId = 'session_' + Date.now();
        const newSess = {
            id: newId,
            title: 'New Chat',
            messages: [
                {
                    id: 'welcome',
                    sender: 'ai',
                    text: 'Hello! I am Aria, your local workflow AI agent. How can I assist you today?',
                    timestamp: new Date().toLocaleTimeString(),
                    pipeline: null
                }
            ]
        };
        setSessions(prev => {
            const updated = [...prev, newSess];
            localStorage.setItem('aria_chat_sessions', JSON.stringify(updated));
            return updated;
        });
        setActiveSessionId(newId);
        localStorage.setItem('aria_active_session_id', newId);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat:sync_history',
                history: []
            }));
        }
    };

    const changeActiveSession = (sessionId) => {
        setActiveSessionId(sessionId);
        localStorage.setItem('aria_active_session_id', sessionId);
        const session = sessions.find(s => s.id === sessionId);
        if (session && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat:sync_history',
                history: session.messages
                    .filter(m => m.id !== 'welcome' && m.id !== 'ai-pending')
                    .map(m => ({
                        role: m.sender === 'ai' ? 'assistant' : 'user',
                        content: m.text,
                        ts: typeof m.id === 'number' ? m.id : Date.now()
                    }))
            }));
        }
    };

    const deleteSession = (sessionId) => {
        if (sessions.length <= 1) return;
        setSessions(prev => {
            const updated = prev.filter(s => s.id !== sessionId);
            localStorage.setItem('aria_chat_sessions', JSON.stringify(updated));
            return updated;
        });
        if (activeSessionId === sessionId) {
            const remaining = sessions.filter(s => s.id !== sessionId);
            const nextActiveId = remaining[0].id;
            setActiveSessionId(nextActiveId);
            localStorage.setItem('aria_active_session_id', nextActiveId);

            const session = remaining[0];
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'chat:sync_history',
                    history: session.messages
                        .filter(m => m.id !== 'welcome' && m.id !== 'ai-pending')
                        .map(m => ({
                            role: m.sender === 'ai' ? 'assistant' : 'user',
                            content: m.text,
                            ts: typeof m.id === 'number' ? m.id : Date.now()
                        }))
                }));
            }
        }
    };

    const wsRef = useRef(null);
    const activeMessageLogsRef = useRef([]);

    const appendLog = (logItem) => {
        setLogs(prev => [...prev, logItem]);
    };

    const resetStages = () => {
        const initialPipeline = {
            input: { status: 'active', detail: 'Waiting...', badge: 'ACTIVE' },
            context: { status: '', detail: '-', badge: '-' },
            router: { status: '', detail: '-', badge: '-' },
            exec: { status: '', detail: '-', badge: '-' },
            reflect: { status: '', detail: '-', badge: '-' },
            output: { status: '', detail: '-', badge: '-' }
        };
        setPipelineState(initialPipeline);
        setMessages(prev => prev.map(m => m.id === 'ai-pending' ? {
            ...m,
            pipeline: initialPipeline
        } : m));
    };

    const setStage = (name, detail, status) => {
        const badge = status.toUpperCase();
        setPipelineState(prev => ({
            ...prev,
            [name]: {
                status,
                detail: detail || prev[name].detail,
                badge
            }
        }));

        setMessages(prev => prev.map(m => m.id === 'ai-pending' ? {
            ...m,
            pipeline: m.pipeline ? {
                ...m.pipeline,
                [name]: {
                    status,
                    detail: detail || m.pipeline[name].detail,
                    badge
                }
            } : null
        } : m));
    };

    useEffect(() => {
        const theme = profile?.preferences?.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);

        const glow = profile?.preferences?.glow || 'normal';
        document.documentElement.setAttribute('data-glow', glow);

        const density = profile?.preferences?.density || 'normal';
        document.documentElement.setAttribute('data-density', density);

        const accent = profile?.preferences?.accent || 'cyan';
        document.documentElement.setAttribute('data-accent', accent);

        const font = profile?.preferences?.font || 'Plus Jakarta Sans';
        document.documentElement.style.setProperty('--font-family-interface', font === 'JetBrains Mono' ? "'JetBrains Mono', monospace" : `'${font}', sans-serif`);

        // Synth Sound Effects Generator
        const soundEnabled = profile?.preferences?.soundEffects ?? false;
        window.playUISound = (type) => {
            if (!soundEnabled) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                const now = ctx.currentTime;
                
                if (type === 'click') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1200, now);
                    osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
                    gain.gain.setValueAtTime(0.04, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
                    osc.start(now);
                    osc.stop(now + 0.05);
                } else if (type === 'success') {
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.setValueAtTime(800, now + 0.08);
                    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
                    gain.gain.setValueAtTime(0.06, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
                    osc.start(now);
                    osc.stop(now + 0.25);
                } else if (type === 'error') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(180, now);
                    osc.frequency.linearRampToValueAtTime(100, now + 0.15);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
                    osc.start(now);
                    osc.stop(now + 0.15);
                } else if (type === 'send') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                } else if (type === 'chime') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
                    gain.gain.setValueAtTime(0.04, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
                    osc.start(now);
                    osc.stop(now + 0.4);
                }
            } catch (e) {
                console.warn("Web Audio API issue:", e);
            }
        };
    }, [profile]);

    useEffect(() => {
        let reconnectTimeout;
        const connect = () => {
            if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
                console.log("[WebSocket] Connection already active or opening. Skipping duplicate connection request.");
                return;
            }
            const isDev = window.location.hostname === 'localhost' && window.location.port !== '4200';
            const wsUrl = isDev ? 'ws://localhost:4200' : `ws://${window.location.host}`;
            console.log("[WebSocket] Connecting to:", wsUrl);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("[WebSocket] Connection opened successfully");
                setConnected(true);
                appendLog({
                    id: Date.now(),
                    type: 'success',
                    time: new Date().toLocaleTimeString(),
                    level: 'success',
                    message: 'Dashboard Link Established'
                });

                // Sync active session history to the backend on connect
                const savedSessions = localStorage.getItem('aria_chat_sessions');
                const savedActiveId = localStorage.getItem('aria_active_session_id');
                if (savedSessions && savedActiveId) {
                    try {
                        const parsedSessions = JSON.parse(savedSessions);
                        const activeSess = parsedSessions.find(s => s.id === savedActiveId);
                        if (activeSess) {
                            ws.send(JSON.stringify({
                                type: 'chat:sync_history',
                                history: activeSess.messages
                                    .filter(m => m.id !== 'welcome' && m.id !== 'ai-pending')
                                    .map(m => ({
                                        role: m.sender === 'ai' ? 'assistant' : 'user',
                                        content: m.text,
                                        ts: typeof m.id === 'number' ? m.id : Date.now()
                                    }))
                            }));
                        }
                    } catch (e) { }
                }
            };

            ws.onclose = () => {
                console.log("[WebSocket] Connection closed");
                setConnected(false);
                reconnectTimeout = setTimeout(connect, 2000);
            };

            ws.onmessage = (e) => {
                try {
                    const evt = JSON.parse(e.data);
                    const timestampStr = evt.timestamp || evt.ts || new Date().toISOString();
                    const time = new Date(timestampStr).toLocaleTimeString();

                    if (evt.type === 'system:sync') {
                        if (evt.payload.workspaceDir) setWorkspaceDir(evt.payload.workspaceDir);
                        if (evt.payload.profile) setProfile(evt.payload.profile);
                        if (evt.payload.plugins) {
                            window.aria_synced_plugins = evt.payload.plugins;
                            window.dispatchEvent(new CustomEvent('system:sync_data', { detail: evt.payload }));
                        }
                        if (evt.payload.history) {
                            const saved = localStorage.getItem('aria_chat_sessions');
                            if (!saved) {
                                const chatMsgs = evt.payload.history.map(h => ({
                                    id: h.ts || Math.random(),
                                    sender: h.role === 'assistant' ? 'ai' : 'user',
                                    text: h.content,
                                    timestamp: h.ts ? new Date(h.ts).toLocaleTimeString() : new Date().toLocaleTimeString(),
                                    pipeline: null
                                }));
                                const initialSession = {
                                    id: 'welcome',
                                    title: 'Welcome Chat',
                                    messages: [
                                        {
                                            id: 'welcome',
                                            sender: 'ai',
                                            text: 'Hello! I am Aria, your local workflow AI agent. How can I assist you today?',
                                            timestamp: new Date().toLocaleTimeString(),
                                            pipeline: null
                                        },
                                        ...chatMsgs
                                    ]
                                };
                                setSessions([initialSession]);
                                setActiveSessionId('welcome');
                                localStorage.setItem('aria_chat_sessions', JSON.stringify([initialSession]));
                                localStorage.setItem('aria_active_session_id', 'welcome');
                            }
                        }
                    }
                    else if (evt.type === 'system:workspace_changed') {
                        setWorkspaceDir(evt.payload.workspaceDir);
                        appendLog({
                            id: Date.now(),
                            type: 'log',
                            time,
                            level: 'success',
                            message: `Workspace directory updated to: ${evt.payload.workspaceDir}`
                        });
                    }
                    else if (evt.type === 'system:memory_cleared') {
                        setMessages([
                            {
                                id: 'welcome',
                                sender: 'ai',
                                text: 'Memory cleared. Ready for a new conversation!',
                                timestamp: new Date().toLocaleTimeString(),
                                pipeline: null
                            }
                        ]);
                        setProfile(prev => ({ ...prev, known_facts: [] }));
                    }
                    else if (evt.type === 'settings:pull_model_done') {
                        appendLog({
                            id: Date.now(),
                            type: 'log',
                            time,
                            level: evt.payload.success ? 'success' : 'error',
                            message: evt.payload.success
                                ? `Successfully pulled model: ${evt.payload.model}`
                                : `Failed to pull model: ${evt.payload.error}`
                        });
                        // Trigger page-level alert or reset pull status if needed
                        window.dispatchEvent(new CustomEvent('settings:pull_done', { detail: evt.payload }));
                    }
                    else if (evt.type === 'log') {
                        const cleanMsg = evt.message.replace(/\x1b\[[0-9;]*m/g, '');
                        const logObj = {
                            id: Date.now() + Math.random(),
                            type: 'log',
                            time,
                            level: evt.level.toLowerCase(),
                            message: cleanMsg
                        };
                        appendLog(logObj);
                        activeMessageLogsRef.current.push(logObj);

                        // Realtime stream logs to UI
                        setMessages(prev => prev.map(m => m.id === 'ai-pending' ? {
                            ...m,
                            logs: [...activeMessageLogsRef.current]
                        } : m));
                    }
                    else if (evt.type === 'stream:token') {
                        const tokenText = evt.payload?.token;
                        if (tokenText) {
                            setMessages(prev => prev.map(m => m.id === 'ai-pending' ? {
                                ...m,
                                text: m.text + tokenText
                            } : m));
                        }
                    }
                    // Handle Pipeline Events
                    else if (evt.type === 'input:received') {
                        activeMessageLogsRef.current = [];
                        resetStages();
                        setStage('input', `Prompt: "${evt.payload.input}"`, 'done');
                        setStage('context', 'Building context...', 'active');
                    }
                    else if (evt.type === 'context:built') {
                        setStage('context', `${evt.payload.historySize} msg in memory`, 'done');
                        setStage('router', 'Routing...', 'active');
                    }
                    else if (evt.type === 'router:decided' || evt.type === 'router:pre_hit') {
                        const r = evt.payload.route;
                        setStage('router', `Mode: ${r.mode.toUpperCase()} (conf: ${r.confidence.toFixed(2)})`, 'done');
                        setStage('exec', 'Executing...', 'active');
                    }
                    else if (evt.type === 'exec:tool_called') {
                        setStage('exec', `Tool: ${evt.payload.tool} ${evt.payload.path || ''}`, 'active');
                    }
                    else if (evt.type === 'exec:done') {
                        setStage('exec', `Done`, 'done');
                        setStage('reflect', 'Reflecting...', 'active');
                    }
                    else if (evt.type === 'reflect:verification_done') {
                        setStage('reflect', `Verification: ${evt.payload.success ? 'Pass' : 'Fail'}`, 'active');
                    }
                    else if (evt.type === 'output:ready') {
                        setStage('reflect', `Profile & Trace updated`, 'done');
                        setStage('output', `Delivered`, 'done');

                        // Finalize current ai pending message, setting text if not streamed
                        setMessages(prev => prev.map(m => m.id === 'ai-pending' ? {
                            ...m,
                            text: m.text || evt.payload?.output || '',
                            id: Date.now() + Math.random(), // assign stable ID
                            logs: [...activeMessageLogsRef.current]
                        } : m));
                    }
                    else if (evt.type === 'system:error') {
                        setStage('exec', `Error: ${evt.payload.error}`, 'error');
                        setMessages(prev => prev.map(m => m.id === 'ai-pending' ? {
                            ...m,
                            id: Date.now() + Math.random(),
                            text: m.text + `\n\n[Pipeline Error]: ${evt.payload.error}`,
                            logs: [...activeMessageLogsRef.current]
                        } : m));
                    }
                    else if (evt.type === 'workbench:files_list') {
                        window.dispatchEvent(new CustomEvent('workbench:files_list', { detail: evt.payload.files }));
                    }
                    else if (evt.type === 'workbench:terminal_output') {
                        window.dispatchEvent(new CustomEvent('workbench:terminal_output', { detail: evt.payload }));
                    }
                    else if (evt.type === 'workbench:terminal_done') {
                        window.dispatchEvent(new CustomEvent('workbench:terminal_done', { detail: evt.payload }));
                    }
                    else if (evt.type === 'workbench:save_done') {
                        window.dispatchEvent(new CustomEvent('workbench:save_done', { detail: evt.payload }));
                    }
                    else if (evt.type === 'workbench:create_done') {
                        window.dispatchEvent(new CustomEvent('workbench:create_done', { detail: evt.payload }));
                    }
                    else if (evt.type === 'workbench:delete_done') {
                        window.dispatchEvent(new CustomEvent('workbench:delete_done', { detail: evt.payload }));
                    }
                    else if (evt.type === 'workbench:execute_done') {
                        window.dispatchEvent(new CustomEvent('workbench:execute_done', { detail: evt.payload }));
                    }
                    else if (evt.type === 'system:profile_updated') {
                        if (evt.payload.profile) setProfile(evt.payload.profile);
                    }
                } catch (err) {
                    console.error("Error parsing WebSocket message:", err);
                }
            };
        };

        const handleReconnectEvent = () => {
            console.log("[WebSocket] Manual reconnect requested to abort active generation");
            clearTimeout(reconnectTimeout);
            if (wsRef.current) {
                const oldWs = wsRef.current;
                oldWs.onclose = null;
                oldWs.onerror = null;
                oldWs.close();
                wsRef.current = null;
            }
            setConnected(false);
            connect();
        };
        window.addEventListener('system:reconnect_ws', handleReconnectEvent);

        connect();

        return () => {
            window.removeEventListener('system:reconnect_ws', handleReconnectEvent);
            console.log("[WebSocket] Cleaning up connection");
            clearTimeout(reconnectTimeout);
            if (wsRef.current) {
                wsRef.current.onopen = null;
                wsRef.current.onclose = null;
                wsRef.current.onmessage = null;
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    return (
        <div className="app-workspace-layout">
            <Navbar
                activePage={activePage}
                setActivePage={setActivePage}
                connected={connected}
                workspaceDir={workspaceDir}
            />

            <main className="main-content-viewport">
                {activePage === 'orb' && (
                    <OrbPage
                        messages={messages}
                        setMessages={setMessages}
                        connected={connected}
                        wsRef={wsRef}
                        profile={profile}
                        orbSentPrompt={orbSentPrompt}
                        setOrbSentPrompt={setOrbSentPrompt}
                    />
                )}
                {activePage === 'chat' && (
                    <ChatPage
                        messages={messages}
                        setMessages={setMessages}
                        connected={connected}
                        wsRef={wsRef}
                        sessions={sessions}
                        activeSessionId={activeSessionId}
                        createNewSession={createNewSession}
                        changeActiveSession={changeActiveSession}
                        deleteSession={deleteSession}
                    />
                )}
                {activePage === 'workbench' && (
                    <WorkbenchPage
                        pipelineState={pipelineState}
                        connected={connected}
                        workspaceDir={workspaceDir}
                        profile={profile}
                        logs={logs}
                        wsRef={wsRef}
                    />
                )}
                {activePage === 'history' && (
                    <HistoryPage
                        sessions={sessions}
                        activeSessionId={activeSessionId}
                        changeActiveSession={changeActiveSession}
                        deleteSession={deleteSession}
                        logs={logs}
                        wsRef={wsRef}
                    />
                )}
                {activePage === 'settings' && (
                    <SettingsPage
                        profile={profile}
                        workspaceDir={workspaceDir}
                        wsRef={wsRef}
                        connected={connected}
                    />
                )}
            </main>

            <LogTerminal logs={logs} setLogs={setLogs} />
        </div>
    );
}

export default App;
