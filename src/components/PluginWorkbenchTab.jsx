import { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Terminal, Image, ZoomIn, Download, Info, Search, Plus, ChevronDown, X } from 'lucide-react';

function PluginWorkbenchTab({ connected, wsRef, profile, setGeneratedImgPath, generatedImgPath, setShowZoomImage }) {
    const dropdownRef = useRef(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [pluginsList, setPluginsList] = useState(() => window.aria_synced_plugins || []);
    const [selectedPlugin, setSelectedPlugin] = useState(() => {
        const list = window.aria_synced_plugins || [];
        return list.length > 0 ? list[0].name : '';
    });
    const [pluginParams, setPluginParams] = useState({});
    const [toolRunning, setToolRunning] = useState(false);
    const [toolResult, setToolResult] = useState('');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // WebSocket events listener
    useEffect(() => {
        const handleExecuteDone = (e) => {
            const res = e.detail;
            setToolRunning(false);
            if (res.success) {
                setToolResult(res.result);
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

        const handleSystemSync = (e) => {
            if (e.detail?.plugins) {
                setPluginsList(e.detail.plugins);
                if (e.detail.plugins.length > 0 && !selectedPlugin) {
                    setSelectedPlugin(e.detail.plugins[0].name);
                }
            }
        };

        window.addEventListener('workbench:execute_done', handleExecuteDone);
        window.addEventListener('system:sync_data', handleSystemSync);

        return () => {
            window.removeEventListener('workbench:execute_done', handleExecuteDone);
            window.removeEventListener('system:sync_data', handleSystemSync);
        };
    }, [selectedPlugin, setGeneratedImgPath]);

    const activePlugin = pluginsList.find(p => p.name === selectedPlugin);

    let isWebSearchResult = false;
    let searchData = null;
    try {
        if (toolResult && toolResult.trim().startsWith('{')) {
            const parsed = JSON.parse(toolResult);
            if (parsed.type === 'websearch') {
                isWebSearchResult = true;
                searchData = parsed;
            }
        }
    } catch (e) {}

    const handleLoadMoreSearch = (nextPage) => {
        if (!connected) return;
        setToolRunning(true);
        wsRef.current.send(JSON.stringify({
            type: 'workbench:execute_tool',
            name: 'websearch',
            params: {
                query: searchData?.query || '',
                page: nextPage
            }
        }));
    };

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

    const renderWebSearchResults = (data) => {
        const { query, page, source, success, error, webLinks = [], images = [], videos = [] } = data;

        if (success === false) {
            return <div className="search-error-alert">{error}</div>;
        }

        return (
            <div className="gorgeous-search-results">
                <div className="search-results-header">
                    <div className="search-title-group">
                        <span className="search-badge">LIVE WEB RESULTS</span>
                        <h3>Search Results for <span className="query-highlight">"{query}"</span></h3>
                    </div>
                    <div className="search-engine-attribution">
                        <span className="attribution-label">Search source:</span>
                        {source === 'DuckDuckGo' ? (
                            <div className="engine-badge ddg-badge" title="DuckDuckGo (SafeSearch OFF)">
                                <span className="badge-logo">🦆</span>
                                <span className="badge-text">DuckDuckGo</span>
                            </div>
                        ) : (
                            <div className="engine-badge yandex-badge" title="Yandex (SafeSearch OFF)">
                                <span className="badge-logo-y">Y</span>
                                <span className="badge-text">Yandex</span>
                            </div>
                        )}
                    </div>
                </div>

                {images.length > 0 && (
                    <div className="search-images-section">
                        <h4 className="section-subtitle"><Image size={15} /> Visual Assets</h4>
                        <div className="search-images-grid">
                            {images.map((img, idx) => (
                                <div key={idx} className="search-image-card" onClick={() => {
                                    setGeneratedImgPath(img.image || img.thumbnail);
                                    setShowZoomImage(true);
                                }}>
                                    <img src={img.image || img.thumbnail} alt={img.title} />
                                    <div className="image-tooltip">{img.title}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {webLinks.length > 0 ? (
                    <div className="search-links-section">
                        <h4 className="section-subtitle"><Search size={15} /> Web Results</h4>
                        <div className="search-links-list">
                            {webLinks.map((link, idx) => (
                                <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="search-link-card">
                                    <div className="link-index">{idx + 1 + (page - 1) * 10}</div>
                                    <div className="link-content">
                                        <div className="link-title">{link.title}</div>
                                        <div className="link-url-display">{link.url}</div>
                                        {link.snippet && <div className="link-snippet">{link.snippet}</div>}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="no-links-placeholder">No web results found on page {page}.</div>
                )}

                <div className="search-pagination-row">
                    <button 
                        className="pagination-btn load-more-btn"
                        onClick={() => handleLoadMoreSearch(page + 1)}
                        disabled={toolRunning}
                    >
                        {toolRunning ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />} 
                        View More (Page {page + 1})
                    </button>
                </div>
            </div>
        );
    };

    const renderLineInline = (str) => {
        const regex = /(!\[.*?\]\(.*?\))|(\[.*?\]\(.*?\))|(\*\*.*?\*\*)|(\`.*?\`)/g;
        const parts = str.split(regex);

        return parts.map((part, partIdx) => {
            if (!part) return null;

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

            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={partIdx} className="md-bold">{part.slice(2, -2)}</strong>;
            }

            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={partIdx} className="md-inline-code">{part.slice(1, -1)}</code>;
            }

            return <span key={partIdx}>{part}</span>;
        });
    };

    const parseMarkdownToReact = (text) => {
        if (!text) return '';
        const lines = text.split('\n');
        return lines.map((line, lineIdx) => {
            if (line.startsWith('### ')) {
                return <h4 key={lineIdx} className="md-h4">{renderLineInline(line.slice(4))}</h4>;
            }
            if (line.startsWith('## ')) {
                return <h3 key={lineIdx} className="md-h3">{renderLineInline(line.slice(3))}</h3>;
            }
            if (line.startsWith('# ')) {
                return <h2 key={lineIdx} className="md-h2">{renderLineInline(line.slice(2))}</h2>;
            }

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
        <div className="workbench-tools-layout">
            <div className="tools-sidebar-params">
                <h3 className="section-title"><Play size={16} /> Execute Backend Plugins</h3>
                <p className="section-desc">Run server plugins manually outside of the conversational pipeline flow. Specify inputs to debug results directly.</p>

                <div className="form-group mt-16" ref={dropdownRef}>
                    <label className="form-label">Select Plugin Tool</label>
                    <div className="custom-dropdown-container">
                        <div 
                            className={`custom-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <span className="dropdown-selected-value">
                                {selectedPlugin || 'Select a plugin...'}
                            </span>
                            <ChevronDown size={16} className={`dropdown-chevron ${dropdownOpen ? 'rotate' : ''}`} />
                        </div>
                        {dropdownOpen && (
                            <div className="custom-dropdown-menu">
                                {pluginsList.length === 0 ? (
                                    <div className="custom-dropdown-item empty">
                                        No plugins synchronized
                                    </div>
                                ) : (
                                    pluginsList.map(p => (
                                        <div 
                                            key={p.name} 
                                            className={`custom-dropdown-item ${selectedPlugin === p.name ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedPlugin(p.name);
                                                setPluginParams({});
                                                setToolResult('');
                                                setGeneratedImgPath(null);
                                                setDropdownOpen(false);
                                            }}
                                        >
                                            {p.name}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
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
                        isWebSearchResult && searchData ? (
                            renderWebSearchResults(searchData)
                        ) : (
                            <div className="console-output-rich">
                                {parseMarkdownToReact(toolResult)}
                            </div>
                        )
                    ) : (
                        <div className="console-empty">
                            <Terminal size={32} className="text-slate" />
                            <span>Terminal is idle. Trigger a plugin execution on the left to see debug outputs.</span>
                        </div>
                    )}

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
    );
}

export default PluginWorkbenchTab;
