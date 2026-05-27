import PipelineVisualizer from '../components/PipelineVisualizer';
import { Cpu, Database, Network, Shield, FolderOpen, User } from 'lucide-react';

function DashboardPage({ pipelineState, connected, workspaceDir, profile, logs }) {
    // Collect some analytics stats
    const debugCount = logs.filter(l => l.level === 'debug' || l.level === 'stage').length;
    const infoCount = logs.filter(l => l.level === 'info' || l.level === 'success').length;
    const errCount = logs.filter(l => l.level === 'error' || l.level === 'warn').length;

    const stats = [
        {
            title: 'Workspace Folder',
            value: workspaceDir ? workspaceDir.split(/[\\/]/).pop() || workspaceDir : 'Loading...',
            sub: workspaceDir || 'Checking...',
            icon: <FolderOpen size={20} className="text-cyan" />,
        },
        {
            title: 'Active User Profile',
            value: profile?.user_name || 'Deep Rajput',
            sub: `${profile?.operating_system || 'Windows'} OS`,
            icon: <User size={20} className="text-blue" />,
        },
        {
            title: 'Execution Logs State',
            value: `${logs.length} Lines`,
            sub: `${errCount} alerts | ${infoCount} info | ${debugCount} trace`,
            icon: <Cpu size={20} className="text-purple" />,
        },
        {
            title: 'Memory Context Status',
            value: profile?.known_facts ? `${profile.known_facts.length} Facts` : '0 Facts',
            sub: 'Stored in user_data.json',
            icon: <Database size={20} className="text-green" />,
        }
    ];

    return (
        <div className="dashboard-page-container">
            <header className="page-section-header">
                <h2 className="page-title">System Monitor & Telemetry</h2>
                <p className="page-subtitle">Real-time status of pipeline events, Ollama backend state, and workspace contexts.</p>
            </header>

            <div className="metrics-grid">
                {stats.map((s, idx) => (
                    <div key={idx} className="metric-card">
                        <div className="metric-icon-box">{s.icon}</div>
                        <div className="metric-info">
                            <span className="metric-label">{s.title}</span>
                            <span className="metric-value">{s.value}</span>
                            <span className="metric-sub" title={s.sub}>{s.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-grid-content">
                <div className="dashboard-left-panel">
                    <PipelineVisualizer pipelineState={pipelineState} />
                </div>

                <div className="dashboard-right-panel">
                    <div className="system-status-card">
                        <h3 className="section-title"><Network size={16} /> Connection Topology</h3>
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
                                <span className="topo-label">Status:</span>
                                <span className={`topo-value ${connected ? 'text-green' : 'text-red'}`}>
                                    {connected ? 'CONNECTED (LIVE)' : 'OFFLINE (RECONNECTING)'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="system-status-card mt-16">
                        <h3 className="section-title"><Shield size={16} /> Security Settings</h3>
                        <div className="topology-list">
                            <div className="topology-item">
                                <span className="topo-label">Workspace Isolation:</span>
                                <span className="topo-value text-green">Active (Safe Paths Enabled)</span>
                            </div>
                            <div className="topology-item">
                                <span className="topo-label">Ollama API Endpoint:</span>
                                <span className="topo-value">http://127.0.0.1:11434</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
