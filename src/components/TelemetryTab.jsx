import { Network, Shield } from 'lucide-react';
import PipelineVisualizer from './PipelineVisualizer';

function TelemetryTab({ pipelineState, connected, workspaceDir }) {
    return (
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
    );
}

export default TelemetryTab;
