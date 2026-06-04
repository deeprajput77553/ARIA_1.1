import { useState, useEffect } from 'react';
import { User, Folder, Download, ShieldAlert, CheckCircle, RefreshCw, Palette, Sparkles, Layers, Type, Volume2 } from 'lucide-react';

function SettingsPage({ profile, workspaceDir, wsRef, connected }) {
    const [userName, setUserName] = useState(profile?.user_name || 'Deep Rajput');
    const [osName, setOsName] = useState(profile?.operating_system || 'Windows');
    const [workspacePath, setWorkspacePath] = useState(workspaceDir || '');
    const [modelToPull, setModelToPull] = useState('');
    const [pulling, setPulling] = useState(false);
    const [pullStatus, setPullStatus] = useState(null);
    const [profileSaved, setProfileSaved] = useState(false);
    const [workspaceSaved, setWorkspaceSaved] = useState(false);
    const [prefSaved, setPrefSaved] = useState(false);
 
    const [themeMode, setThemeMode] = useState(profile?.preferences?.theme || 'dark');
    const [glowIntensity, setGlowIntensity] = useState(profile?.preferences?.glow || 'normal');
    const [density, setDensity] = useState(profile?.preferences?.density || 'normal');
    const [interfaceFont, setInterfaceFont] = useState(profile?.preferences?.font || 'Plus Jakarta Sans');
    const [accentColor, setAccentColor] = useState(profile?.preferences?.accent || 'cyan');
    const [soundEffects, setSoundEffects] = useState(profile?.preferences?.soundEffects ?? false);
    const [voiceRate, setVoiceRate] = useState(profile?.preferences?.voiceRate ?? 1.0);
    const [voicePitch, setVoicePitch] = useState(profile?.preferences?.voicePitch ?? 1.0);
 
    useEffect(() => {
        if (profile) {
            setTimeout(() => {
                setThemeMode(prev => {
                    const newVal = profile.preferences?.theme || 'dark';
                    return prev !== newVal ? newVal : prev;
                });
                setGlowIntensity(prev => {
                    const newVal = profile.preferences?.glow || 'normal';
                    return prev !== newVal ? newVal : prev;
                });
                setDensity(prev => {
                    const newVal = profile.preferences?.density || 'normal';
                    return prev !== newVal ? newVal : prev;
                });
                setInterfaceFont(prev => {
                    const newVal = profile.preferences?.font || 'Plus Jakarta Sans';
                    return prev !== newVal ? newVal : prev;
                });
                setAccentColor(prev => {
                    const newVal = profile.preferences?.accent || 'cyan';
                    return prev !== newVal ? newVal : prev;
                });
                setSoundEffects(prev => {
                    const newVal = profile.preferences?.soundEffects ?? false;
                    return prev !== newVal ? newVal : prev;
                });
                setVoiceRate(prev => {
                    const newVal = profile.preferences?.voiceRate ?? 1.0;
                    return prev !== newVal ? newVal : prev;
                });
                setVoicePitch(prev => {
                    const newVal = profile.preferences?.voicePitch ?? 1.0;
                    return prev !== newVal ? newVal : prev;
                });
            }, 0);
        }
    }, [profile]);
 
    const handleSavePreferences = (e) => {
        e.preventDefault();
        if (!connected) return;
 
        const updatedProfile = {
            ...profile,
            preferences: {
                ...profile.preferences,
                theme: themeMode,
                glow: glowIntensity,
                density: density,
                font: interfaceFont,
                accent: accentColor,
                soundEffects: soundEffects,
                voiceRate: voiceRate,
                voicePitch: voicePitch
            }
        };
 
        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));
 
        setPrefSaved(true);
        setTimeout(() => setPrefSaved(false), 3000);
    };
 
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

                <div className="settings-card-item col-span-2">
                    <h3 className="settings-card-title"><Palette size={16} /> Appearance & Accessibility</h3>
                    <form onSubmit={handleSavePreferences} className="settings-form">
                        <div className="settings-form-grid-2">
                            <div className="form-group">
                                <label className="form-label"><Palette size={14} style={{ marginRight: '6px' }} /> Theme Color Mode</label>
                                <select 
                                    className="form-input" 
                                    value={themeMode} 
                                    onChange={(e) => setThemeMode(e.target.value)}
                                >
                                    <option value="dark">Dark Theme (Futuristic Neon Cyan & Purple)</option>
                                    <option value="light">Light Theme (Sunset White, Pink, Orange & Yellow)</option>
                                </select>
                                <span className="form-help">Customize the master interface theme mode.</span>
                            </div>
 
                            <div className="form-group">
                                <label className="form-label"><Palette size={14} style={{ marginRight: '6px' }} /> Brand Accent Theme</label>
                                <select 
                                    className="form-input" 
                                    value={accentColor} 
                                    onChange={(e) => setAccentColor(e.target.value)}
                                >
                                    <option value="cyan">Cyber Cyan (Default)</option>
                                    <option value="pink">Electric Pink</option>
                                    <option value="green">Emerald Green</option>
                                    <option value="violet">Electric Violet</option>
                                    <option value="orange">Sunset Orange</option>
                                </select>
                                <span className="form-help">Customize highlights, active borders, and neon glows.</span>
                            </div>

                            <div className="form-group">
                                <label className="form-label"><Sparkles size={14} style={{ marginRight: '6px' }} /> Accent Glow Level</label>
                                <select 
                                    className="form-input" 
                                    value={glowIntensity} 
                                    onChange={(e) => setGlowIntensity(e.target.value)}
                                >
                                    <option value="subtle">Subtle (Soft Shadows & Borders)</option>
                                    <option value="normal">Normal (Standard Glassmorphism Glow)</option>
                                    <option value="glowing">Glowing (Vibrant Sci-Fi Laser Glow)</option>
                                </select>
                                <span className="form-help">Adjust the intensity of active neon accent glows.</span>
                            </div>
 
                            <div className="form-group">
                                <label className="form-label"><Layers size={14} style={{ marginRight: '6px' }} /> Interface Layout Density</label>
                                <select 
                                    className="form-input" 
                                    value={density} 
                                    onChange={(e) => setDensity(e.target.value)}
                                >
                                    <option value="normal">Normal (Default spacing)</option>
                                    <option value="compact">Compact (Smaller padding & font size)</option>
                                </select>
                                <span className="form-help">Optimize screen space utilization.</span>
                            </div>
 
                            <div className="form-group">
                                <label className="form-label"><Type size={14} style={{ marginRight: '6px' }} /> Master Typography Font</label>
                                <select 
                                    className="form-input" 
                                    value={interfaceFont} 
                                    onChange={(e) => setInterfaceFont(e.target.value)}
                                >
                                    <option value="Plus Jakarta Sans">Plus Jakarta Sans (Sleek Sans)</option>
                                    <option value="Outfit">Outfit (Geometric & Modern)</option>
                                    <option value="JetBrains Mono">JetBrains Mono (Developer Tech)</option>
                                </select>
                                <span className="form-help">Choose the primary interface font style.</span>
                            </div>

                            <div className="form-group">
                                <label className="form-label"><Volume2 size={14} style={{ marginRight: '6px' }} /> UI Sonic Interactions</label>
                                <select 
                                    className="form-input" 
                                    value={soundEffects ? 'on' : 'off'} 
                                    onChange={(e) => setSoundEffects(e.target.value === 'on')}
                                >
                                    <option value="off">Off (Silent UI)</option>
                                    <option value="on">On (Subtle Chimes & Click Feedback)</option>
                                </select>
                                <span className="form-help">Enable synthesized sound effects on interactions.</span>
                            </div>

                            <div className="form-group">
                                <label className="form-label"><Volume2 size={14} style={{ marginRight: '6px' }} /> Voice Speech Speed ({voiceRate}x)</label>
                                <input 
                                    type="range" 
                                    min="0.8" 
                                    max="1.8" 
                                    step="0.1" 
                                    className="form-range-input" 
                                    value={voiceRate} 
                                    onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                                />
                                <span className="form-help">Adjust speech synthesis playback speed on the Orb page.</span>
                            </div>

                            <div className="form-group">
                                <label className="form-label"><Volume2 size={14} style={{ marginRight: '6px' }} /> Voice Speech Pitch ({voicePitch})</label>
                                <input 
                                    type="range" 
                                    min="0.5" 
                                    max="1.5" 
                                    step="0.1" 
                                    className="form-range-input" 
                                    value={voicePitch} 
                                    onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                                />
                                <span className="form-help">Adjust speech synthesis voice pitch on the Orb page.</span>
                            </div>
                        </div>
 
                        <div className="settings-actions-row">
                            <button type="submit" className="save-settings-btn" disabled={!connected}>
                                Save Customizations
                            </button>
                            {prefSaved && (
                                <span className="success-badge"><CheckCircle size={14} /> Preferences updated successfully!</span>
                            )}
                        </div>
                    </form>
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
