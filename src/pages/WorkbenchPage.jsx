import { useState } from 'react';
import { Database, Play, Activity, FileText, X } from 'lucide-react';
import MemoryConsoleTab from '../components/MemoryConsoleTab';
import PluginWorkbenchTab from '../components/PluginWorkbenchTab';
import TelemetryTab from '../components/TelemetryTab';
import LiveLogsTab from '../components/LiveLogsTab';

function WorkbenchPage({ pipelineState, connected, workspaceDir, profile, logs, wsRef, installedModels }) {
    const [activeTab, setActiveTab] = useState('memory');
    const [generatedImgPath, setGeneratedImgPath] = useState(null);
    const [showZoomImage, setShowZoomImage] = useState(false);

    return (
        <div className="workbench-page-container">
            <header className="page-section-header">
                <div className="header-title-row">
                    <h2 className="page-title">Developer Studio & Workbench</h2>
                    <span className={`status-pill ${connected ? 'live' : 'offline'}`}>
                        {connected ? 'CONNECTED (LIVE)' : 'OFFLINE (RECONNECTING)'}
                    </span>
                </div>
                <p className="page-subtitle">AI memory database console, interactive plugin tester, pipeline monitoring, and diagnostic logs.</p>
            </header>

            {/* --- Workbench Tabs --- */}
            <div className="workbench-tab-row">
                <button
                    className={`workbench-tab ${activeTab === 'memory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('memory')}
                >
                    <Database size={16} /> AI Memory Console ({profile?.known_facts?.length || 0})
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
                    <FileText size={16} /> Live Logs ({logs.length})
                </button>
            </div>

            {/* --- TAB PANELS --- */}
            <div className="workbench-content-viewport">
                {activeTab === 'memory' && (
                    <MemoryConsoleTab 
                        profile={profile} 
                        connected={connected} 
                        wsRef={wsRef} 
                    />
                )}

                {activeTab === 'tools' && (
                    <PluginWorkbenchTab 
                        connected={connected} 
                        wsRef={wsRef} 
                        profile={profile}
                        generatedImgPath={generatedImgPath}
                        setGeneratedImgPath={setGeneratedImgPath}
                        setShowZoomImage={setShowZoomImage}
                    />
                )}

                {activeTab === 'diagnostics' && (
                    <TelemetryTab 
                        pipelineState={pipelineState} 
                        connected={connected} 
                        workspaceDir={workspaceDir} 
                        installedModels={installedModels}
                        profile={profile}
                    />
                )}

                {activeTab === 'logs' && (
                    <LiveLogsTab 
                        logs={logs} 
                    />
                )}
            </div>

            {/* --- ZOOM IMAGE MODAL OVERLAY --- */}
            {showZoomImage && generatedImgPath && (
                <div className="zoom-image-overlay" onClick={() => setShowZoomImage(false)}>
                    <div className="zoom-image-container" onClick={(e) => e.stopPropagation()}>
                        <button className="zoom-close-btn" onClick={() => setShowZoomImage(false)}>
                            <X size={20} />
                        </button>
                        <img
                            src={(() => {
                                if (generatedImgPath.startsWith('http://') || generatedImgPath.startsWith('https://') || generatedImgPath.startsWith('data:')) {
                                    return generatedImgPath;
                                }
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
