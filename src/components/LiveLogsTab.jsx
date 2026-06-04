import { useState } from 'react';
import { Search, Terminal } from 'lucide-react';

function LiveLogsTab({ logs = [] }) {
    const [logFilter, setLogFilter] = useState('all');
    const [logSearch, setLogSearch] = useState('');

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

    return (
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
    );
}

export default LiveLogsTab;
