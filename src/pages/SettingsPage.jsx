import { useState, useEffect } from 'react';
import { User, Folder, Download, ShieldAlert, CheckCircle, RefreshCw, Palette, Sparkles, Layers, Type, Volume2, Cpu, AlertTriangle, Database } from 'lucide-react';

function SettingsPage({ profile, workspaceDir, wsRef, connected, installedModels = [] }) {
    const [userName, setUserName] = useState(profile?.user_name || 'Deep Rajput');
    const [osName, setOsName] = useState(profile?.operating_system || 'Windows');
    const [workspacePath, setWorkspacePath] = useState(workspaceDir || '');
    const [modelToPull, setModelToPull] = useState('');
    const [pulling, setPulling] = useState(false);
    const [pullStatus, setPullStatus] = useState(null);
    const [profileSaved, setProfileSaved] = useState(false);
    const [workspaceSaved, setWorkspaceSaved] = useState(false);
    const [prefSaved, setPrefSaved] = useState(false);
    const [mappingsSaved, setMappingsSaved] = useState(false);
 
    const [themeMode, setThemeMode] = useState(profile?.preferences?.theme || 'dark');
    const [glowIntensity, setGlowIntensity] = useState(profile?.preferences?.glow || 'normal');
    const [density, setDensity] = useState(profile?.preferences?.density || 'normal');
    const [interfaceFont, setInterfaceFont] = useState(profile?.preferences?.font || 'Plus Jakarta Sans');
    const [accentColor, setAccentColor] = useState(profile?.preferences?.accent || 'cyan');
    const [soundEffects, setSoundEffects] = useState(profile?.preferences?.soundEffects ?? false);
    const [voiceRate, setVoiceRate] = useState(profile?.preferences?.voiceRate ?? 1.0);
    const [voicePitch, setVoicePitch] = useState(profile?.preferences?.voicePitch ?? 1.0);

    const [routerModel, setRouterModel] = useState(profile?.agent_models?.ROUTER || 'llama3.2:1b');
    const [reactiveModel, setReactiveModel] = useState(profile?.agent_models?.REACTIVE || 'llama3:latest');
    const [complexModelName, setComplexModelName] = useState(profile?.agent_models?.COMPLEX || 'qwen2.5-coder:7b');
    const [verifyModelName, setVerifyModelName] = useState(profile?.agent_models?.VERIFY || 'codellama:latest');
 
    useEffect(() => {
        if (profile?.agent_models) {
            setTimeout(() => {
                setRouterModel(profile.agent_models.ROUTER || 'llama3.2:1b');
                setReactiveModel(profile.agent_models.REACTIVE || 'llama3:latest');
                setComplexModelName(profile.agent_models.COMPLEX || 'qwen2.5-coder:7b');
                setVerifyModelName(profile.agent_models.VERIFY || 'codellama:latest');
            }, 0);
        }
    }, [profile]);

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

    const handlePullRecommendedModel = (modelName) => {
        if (!connected) return;
        setPulling(true);
        setPullStatus(`Pulling recommended model: ${modelName}...`);
        wsRef.current.send(JSON.stringify({
            type: 'settings:pull_model',
            model: modelName
        }));
    };

    const isInstalled = (modelName) => {
        if (!modelName) return false;
        return installedModels.some(m => {
            const mName = typeof m === 'string' ? m : m.name;
            return mName === modelName || mName.split(':')[0] === modelName.split(':')[0];
        });
    };

    const getOptionsForRole = (currentValue) => {
        const names = installedModels.map(m => typeof m === 'string' ? m : m.name);
        if (currentValue && !names.includes(currentValue)) {
            return [currentValue, ...names];
        }
        return names.length > 0 ? names : [currentValue];
    };

    const formatSize = (bytes) => {
        if (!bytes) return 'N/A';
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(2)} GB`;
    };
 
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

    const handleSaveModelMappings = (e) => {
        e.preventDefault();
        if (!connected) return;

        const updatedProfile = {
            ...profile,
            agent_models: {
                ROUTER: routerModel,
                REACTIVE: reactiveModel,
                COMPLEX: complexModelName,
                VERIFY: verifyModelName
            }
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setMappingsSaved(true);
        setTimeout(() => setMappingsSaved(false), 3000);
    };

    useEffect(() => {
        const handlePullDone = (e) => {
            setPulling(false);
            setPullStatus(e.detail.success ? 'Model successfully installed!' : `Failed to pull model: ${e.detail.error}`);
            setTimeout(() => setPullStatus(null), 5000);
        };
        window.addEventListener('settings:pull_done', handlePullDone);
        return () => window.removeEventListener('settings:pull_done', handlePullDone);
    }, []);

    return (
        <div className="settings-page-container">
            {pulling && (
                <div className="glass-pulling-overlay">
                    <div className="overlay-content">
                        <RefreshCw className="spin text-purple" size={40} />
                        <h4>Downloading Ollama Model</h4>
                        <p>{pullStatus}</p>
                    </div>
                </div>
            )}
            
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

                {/* Model Hub Control Center */}
                <div className="settings-card-item col-span-2 model-hub-card">
                    <h3 className="settings-card-title"><Cpu size={16} /> Model Hub Control Center</h3>
                    
                    <form onSubmit={handleSaveModelMappings} className="settings-form">
                        <p className="settings-section-desc">Assign specific local models to each agent role. If a configured model is missing, the system dynamically routes execution to an active fallback model.</p>
                        
                        <div className="model-roles-list">
                            {/* Router Role */}
                            <div className="model-role-row">
                                <div className="role-info">
                                    <span className="role-name">Router Role</span>
                                    <span className="role-desc">Classifies inputs and decides agent execution paths.</span>
                                </div>
                                <div className="role-controls">
                                    <select 
                                        className="form-input role-select" 
                                        value={routerModel} 
                                        onChange={(e) => setRouterModel(e.target.value)}
                                    >
                                        {getOptionsForRole(routerModel).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                    
                                    <div className="role-status-badge">
                                        {isInstalled(routerModel) ? (
                                            <span className="badge-status installed"><CheckCircle size={12} /> Installed</span>
                                        ) : (
                                            <span className="badge-status fallback"><AlertTriangle size={12} /> Fallback Active</span>
                                        )}
                                    </div>
                                    
                                    {!isInstalled('llama3.2:1b') && (
                                        <button 
                                            type="button" 
                                            className="pull-recommended-btn"
                                            disabled={pulling}
                                            onClick={() => handlePullRecommendedModel('llama3.2:1b')}
                                        >
                                            <Download size={10} /> Pull 1.3B Rec
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Reactive Role */}
                            <div className="model-role-row">
                                <div className="role-info">
                                    <span className="role-name">Reactive Role</span>
                                    <span className="role-desc">Handles simple queries, general chats, and quick answers.</span>
                                </div>
                                <div className="role-controls">
                                    <select 
                                        className="form-input role-select" 
                                        value={reactiveModel} 
                                        onChange={(e) => setReactiveModel(e.target.value)}
                                    >
                                        {getOptionsForRole(reactiveModel).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                    
                                    <div className="role-status-badge">
                                        {isInstalled(reactiveModel) ? (
                                            <span className="badge-status installed"><CheckCircle size={12} /> Installed</span>
                                        ) : (
                                            <span className="badge-status fallback"><AlertTriangle size={12} /> Fallback Active</span>
                                        )}
                                    </div>
                                    
                                    {!isInstalled('llama3:latest') && (
                                        <button 
                                            type="button" 
                                            className="pull-recommended-btn"
                                            disabled={pulling}
                                            onClick={() => handlePullRecommendedModel('llama3:latest')}
                                        >
                                            <Download size={10} /> Pull 8B Rec
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Complex Planner Role */}
                            <div className="model-role-row">
                                <div className="role-info">
                                    <span className="role-name">Complex Planner Role</span>
                                    <span className="role-desc">Orchestrates multi-step code generation and reasoning.</span>
                                </div>
                                <div className="role-controls">
                                    <select 
                                        className="form-input role-select" 
                                        value={complexModelName} 
                                        onChange={(e) => setComplexModelName(e.target.value)}
                                    >
                                        {getOptionsForRole(complexModelName).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                    
                                    <div className="role-status-badge">
                                        {isInstalled(complexModelName) ? (
                                            <span className="badge-status installed"><CheckCircle size={12} /> Installed</span>
                                        ) : (
                                            <span className="badge-status fallback"><AlertTriangle size={12} /> Fallback Active</span>
                                        )}
                                    </div>
                                    
                                    {!isInstalled('qwen2.5-coder:7b') && (
                                        <button 
                                            type="button" 
                                            className="pull-recommended-btn"
                                            disabled={pulling}
                                            onClick={() => handlePullRecommendedModel('qwen2.5-coder:7b')}
                                        >
                                            <Download size={10} /> Pull 7B Rec
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Code Auditor Role */}
                            <div className="model-role-row">
                                <div className="role-info">
                                    <span className="role-name">Code Auditor Role</span>
                                    <span className="role-desc">Performs code verification, lint audits, and logic checks.</span>
                                </div>
                                <div className="role-controls">
                                    <select 
                                        className="form-input role-select" 
                                        value={verifyModelName} 
                                        onChange={(e) => setVerifyModelName(e.target.value)}
                                    >
                                        {getOptionsForRole(verifyModelName).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                    
                                    <div className="role-status-badge">
                                        {isInstalled(verifyModelName) ? (
                                            <span className="badge-status installed"><CheckCircle size={12} /> Installed</span>
                                        ) : (
                                            <span className="badge-status fallback"><AlertTriangle size={12} /> Fallback Active</span>
                                        )}
                                    </div>
                                    
                                    {!isInstalled('codellama:latest') && (
                                        <button 
                                            type="button" 
                                            className="pull-recommended-btn"
                                            disabled={pulling}
                                            onClick={() => handlePullRecommendedModel('codellama:latest')}
                                        >
                                            <Download size={10} /> Pull 7B Rec
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="settings-actions-row">
                            <button type="submit" className="save-settings-btn" disabled={!connected}>
                                Save Role Mappings
                            </button>
                            {mappingsSaved && (
                                <span className="success-badge"><CheckCircle size={14} /> Agent model mappings updated successfully!</span>
                            )}
                        </div>
                    </form>

                    <div className="divider-line" />

                    <h4 className="model-hub-subtitle"><Download size={14} /> Pull Custom Model from Registry</h4>
                    <form onSubmit={handlePullModel} className="settings-form horizontal-form">
                        <div className="form-group flex-grow">
                            <div className="input-with-button">
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="e.g. mistral:latest, llama3.2:3b" 
                                    value={modelToPull} 
                                    onChange={(e) => setModelToPull(e.target.value)} 
                                    disabled={pulling}
                                />
                                <button type="submit" className="pull-model-btn" disabled={pulling || !modelToPull.trim() || !connected}>
                                    {pulling ? <RefreshCw className="spin" size={14} /> : <Download size={14} />} Pull Model
                                </button>
                            </div>
                            <span className="form-help">Pulls any model directly from the Ollama repository to your local server.</span>
                        </div>
                    </form>
                </div>

                {/* Local Installed Models Library */}
                <div className="settings-card-item col-span-2 library-card">
                    <h3 className="settings-card-title"><Database size={16} /> Local Installed Models Library</h3>
                    <p className="settings-section-desc">View and manage all models currently hosted on your local Ollama server.</p>
                    
                    {installedModels.length === 0 ? (
                        <div className="empty-library-warning">
                            <AlertTriangle size={24} className="text-yellow" />
                            <div className="warning-text-container">
                                <span className="warning-title">No Local Models Detected</span>
                                <span className="warning-desc">Ensure Ollama is running (`ollama serve`) and that you have pulled at least one model.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="model-library-grid">
                            {installedModels.map((model) => (
                                <div key={model.name} className="model-library-card">
                                    <div className="model-card-header">
                                        <span className="model-card-name" title={model.name}>{model.name}</span>
                                        <span className="model-card-badge">{model.parameterSize}</span>
                                    </div>
                                    <div className="model-card-details">
                                        <div className="detail-row">
                                            <span className="detail-label">File Size:</span>
                                            <span className="detail-value">{formatSize(model.size)}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Format:</span>
                                            <span className="detail-value text-blue">{model.format}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Quantization:</span>
                                            <span className="detail-value text-purple">{model.quantizationLevel}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
