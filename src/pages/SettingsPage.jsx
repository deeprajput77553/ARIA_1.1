import { useState } from 'react';
import { Settings, User, Folder, Download, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';

function SettingsPage({ profile, workspaceDir, wsRef, connected }) {
    const [userName, setUserName] = useState(profile?.user_name || 'Deep Rajput');
    const [osName, setOsName] = useState(profile?.operating_system || 'Windows');
    const [workspacePath, setWorkspacePath] = useState(workspaceDir || '');
    const [modelToPull, setModelToPull] = useState('');
    const [pulling, setPulling] = useState(false);
    const [pullStatus, setPullStatus] = useState(null);
    const [profileSaved, setProfileSaved] = useState(false);
    const [workspaceSaved, setWorkspaceSaved] = useState(false);

    const handleSaveProfile = (e) => {
        e.preventDefault();
        if (!connected) return;

        const updatedProfile = {
            ...profile,
            user_name: userName,
            operating_system: osName
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
    };

    const handleSaveWorkspace = (e) => {
        e.preventDefault();
        if (!workspacePath.trim() || !connected) return;

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_workspace',
            path: workspacePath
        }));

        setWorkspaceSaved(true);
        setTimeout(() => setWorkspaceSaved(false), 3000);
    };

    const handlePullModel = (e) => {
        e.preventDefault();
        if (!modelToPull.trim() || !connected) return;

        setPulling(true);
        setPullStatus('Pulling model from Ollama registry...');

        wsRef.current.send(JSON.stringify({
            type: 'settings:pull_model',
            model: modelToPull
        }));

        // Reset text field
        setModelToPull('');
    };

    // We can handle incoming model pull notifications if the parent app forwards them.
    // For now we will support listening to a custom event or log update.
    return (
        <div className="settings-page-container">
            <header className="page-section-header">
                <h2 className="page-title">Configuration & Settings</h2>
                <p className="page-subtitle">Configure user preferences, change folders, and manage models.</p>
            </header>

            <div className="settings-cards-grid">
                
                <div className="settings-card-item">
                    <h3 className="settings-card-title"><User size={16} /> User Profile Information</h3>
                    <form onSubmit={handleSaveProfile} className="settings-form">
                        <div className="form-group">
                            <label className="form-label">User Name</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={userName} 
                                onChange={(e) => setUserName(e.target.value)} 
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Operating System</label>
                            <select 
                                className="form-input" 
                                value={osName} 
                                onChange={(e) => setOsName(e.target.value)}
                            >
                                <option value="Windows">Windows</option>
                                <option value="Linux">Linux</option>
                                <option value="macOS">macOS</option>
                            </select>
                        </div>
                        <button type="submit" className="save-settings-btn" disabled={!connected}>
                            Save Profile
                        </button>
                        {profileSaved && (
                            <span className="success-badge"><CheckCircle size={14} /> Profile updated successfully!</span>
                        )}
                    </form>
                </div>

                <div className="settings-card-item">
                    <h3 className="settings-card-title"><Folder size={16} /> Workspace Directory Path</h3>
                    <form onSubmit={handleSaveWorkspace} className="settings-form">
                        <div className="form-group">
                            <label className="form-label">Workspace Folder Absolute Path</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={workspacePath} 
                                onChange={(e) => setWorkspacePath(e.target.value)} 
                                required
                            />
                            <span className="form-help">Where Aria reads and writes project files.</span>
                        </div>
                        <button type="submit" className="save-settings-btn" disabled={!connected}>
                            Change Workspace
                        </button>
                        {workspaceSaved && (
                            <span className="success-badge"><CheckCircle size={14} /> Workspace directory updated!</span>
                        )}
                    </form>
                </div>

                <div className="settings-card-item col-span-2">
                    <h3 className="settings-card-title"><Download size={16} /> Ollama Model Registry Manager</h3>
                    <form onSubmit={handlePullModel} className="settings-form horizontal-form">
                        <div className="form-group flex-grow">
                            <label className="form-label">Pull Model Name</label>
                            <div className="input-with-button">
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="e.g. llama3.2:1b, qwen2.5-coder:7b" 
                                    value={modelToPull} 
                                    onChange={(e) => setModelToPull(e.target.value)} 
                                    disabled={pulling}
                                />
                                <button type="submit" className="pull-model-btn" disabled={pulling || !modelToPull.trim() || !connected}>
                                    {pulling ? <RefreshCw className="spin" size={14} /> : <Download size={14} />} Pull Model
                                </button>
                            </div>
                            <span className="form-help">Pulls the specified model directly from the Ollama library on your local server.</span>
                        </div>
                    </form>

                    {pulling && (
                        <div className="pull-progress-status">
                            <RefreshCw size={14} className="spin text-blue" />
                            <span>{pullStatus}</span>
                        </div>
                    )}
                </div>

                <div className="settings-card-item col-span-2 warning-card">
                    <h3 className="settings-card-title text-red"><ShieldAlert size={16} /> Danger Zone</h3>
                    <div className="danger-zone-body">
                        <div className="danger-info">
                            <span className="danger-title">Reset Memory and Context Cache</span>
                            <span className="danger-desc">This will erase all conversation logs, memory indices, and extracted profile facts. This action is irreversible.</span>
                        </div>
                        <button 
                            className="danger-action-btn"
                            onClick={() => {
                                if (confirm("Clear all memory and profiles?")) {
                                    wsRef.current.send(JSON.stringify({ type: 'settings:clear_memory' }));
                                    alert("Memory cleared!");
                                }
                            }}
                            disabled={!connected}
                        >
                            Reset System Context
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default SettingsPage;
