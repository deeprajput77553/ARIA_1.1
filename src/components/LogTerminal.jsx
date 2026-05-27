import { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, ChevronsDown, Bug, Info, AlertTriangle, XCircle, Wrench, Check, X, ChevronUp } from 'lucide-react';

function LogTerminal({ logs, setLogs }) {
    const [isOpen, setIsOpen] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const terminalRef = useRef(null);

    useEffect(() => {
        if (autoScroll && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs, autoScroll, isOpen]);

    const getLogIcon = (lvl) => {
        switch (lvl) {
            case 'debug': return <Bug size={12} strokeWidth={2.5} />;
            case 'info': return <Info size={12} strokeWidth={2.5} />;
            case 'warn': return <AlertTriangle size={12} strokeWidth={2.5} />;
            case 'error': return <XCircle size={12} strokeWidth={2.5} />;
            case 'trace': return <Terminal size={12} strokeWidth={2.5} />;
            case 'stage': return <Terminal size={12} strokeWidth={2.5} />;
            case 'tool': return <Wrench size={12} strokeWidth={2.5} />;
            case 'success': return <Check size={12} strokeWidth={2.5} />;
            case 'fail': return <X size={12} strokeWidth={2.5} />;
            default: return <Info size={12} strokeWidth={2.5} />;
        }
    };

    return (
        <div className={`terminal-drawer ${isOpen ? 'open' : 'collapsed'}`}>
            <div className="terminal-header" onClick={() => setIsOpen(!isOpen)}>
                <span className="terminal-header-title">
                    <Terminal size={16} /> Developer Logs ({logs.length})
                </span>
                <div className="terminal-header-controls" onClick={(e) => e.stopPropagation()}>
                    <button className="control-btn clear-btn" title="Clear logs" onClick={() => setLogs([])}>
                        <Trash2 size={13} /> Clear
                    </button>
                    <button className={`control-btn scroll-btn ${autoScroll ? 'active' : ''}`} title="Toggle Auto Scroll" onClick={() => setAutoScroll(!autoScroll)}>
                        <ChevronsDown size={13} /> Auto-Scroll
                    </button>
                    <button className="toggle-btn" onClick={() => setIsOpen(!isOpen)}>
                        <ChevronUp size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="terminal-body" ref={terminalRef}>
                    {logs.length === 0 ? (
                        <div className="terminal-empty-text">No execution logs yet. Logs will stream in as tasks run.</div>
                    ) : (
                        logs.map((log) => {
                            if (log.type === 'token') {
                                return <div key={log.id} className="log-line token">{log.text}</div>;
                            }

                            let lvlClass = `level-${log.level || 'info'}`;
                            let levelLabel = (log.level || 'INFO').toUpperCase();
                            if (log.level === 'stage') {
                                lvlClass = 'level-debug';
                                levelLabel = 'STAGE';
                            }

                            return (
                                <div key={log.id} className="log-line">
                                    <span className="log-time">{log.time}</span>
                                    <span className={`log-badge ${lvlClass}`}>
                                        {getLogIcon(log.level)} {levelLabel}
                                    </span>
                                    <span className="log-content">{log.message}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

export default LogTerminal;
