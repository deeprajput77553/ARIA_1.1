import { useState, useEffect } from 'react';
import { Database, Plus, Edit3, Trash2, Info, User, Network } from 'lucide-react';

function MemoryConsoleTab({ profile, connected, wsRef }) {
    const [facts, setFacts] = useState(profile?.known_facts || []);
    const [newFact, setNewFact] = useState('');
    const [editingFactIndex, setEditingFactIndex] = useState(-1);
    const [editingFactText, setEditingFactText] = useState('');

    const [newUserDataKey, setNewUserDataKey] = useState('');
    const [newUserDataVal, setNewUserDataVal] = useState('');
    const [editingUserDataKey, setEditingUserDataKey] = useState('');
    const [editingUserDataVal, setEditingUserDataVal] = useState('');

    const [newAgentKey, setNewAgentKey] = useState('');
    const [newAgentVal, setNewAgentVal] = useState('');
    const [editingAgentKey, setEditingAgentKey] = useState('');
    const [editingAgentVal, setEditingAgentVal] = useState('');

    useEffect(() => {
        if (profile?.known_facts) {
            setFacts(profile.known_facts);
        }
    }, [profile]);

    const handleAddFact = (e) => {
        e.preventDefault();
        if (!newFact.trim() || !connected) return;
        const updatedFacts = [...facts, newFact.trim()];
        setFacts(updatedFacts);
        setNewFact('');

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: {
                ...profile,
                known_facts: updatedFacts
            }
        }));
    };

    const handleSaveEditFact = (index) => {
        if (!editingFactText.trim() || !connected) return;
        const updatedFacts = [...facts];
        const oldFact = updatedFacts[index];
        if (typeof oldFact === 'object' && oldFact !== null) {
            updatedFacts[index] = { ...oldFact, text: editingFactText.trim() };
        } else {
            updatedFacts[index] = editingFactText.trim();
        }
        setFacts(updatedFacts);
        setEditingFactIndex(-1);

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: {
                ...profile,
                known_facts: updatedFacts
            }
        }));
    };

    const handleDeleteFact = (index) => {
        if (!connected) return;
        const updatedFacts = facts.filter((_, idx) => idx !== index);
        setFacts(updatedFacts);

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: {
                ...profile,
                known_facts: updatedFacts
            }
        }));
    };

    const handleAddUserData = (e) => {
        e.preventDefault();
        const key = newUserDataKey.trim();
        const val = newUserDataVal.trim();
        if (!key || !val || !connected) return;

        let parsedVal = val;
        if (val.startsWith('[') || val.startsWith('{')) {
            try { parsedVal = JSON.parse(val); } catch (err) { }
        }

        const updatedProfile = {
            ...profile,
            [key]: parsedVal
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setNewUserDataKey('');
        setNewUserDataVal('');
    };

    const handleSaveEditUserData = (key) => {
        if (!editingUserDataVal.trim() || !connected) return;
        let parsedVal = editingUserDataVal.trim();
        if (parsedVal.startsWith('[') || parsedVal.startsWith('{')) {
            try { parsedVal = JSON.parse(parsedVal); } catch (err) { }
        }

        const updatedProfile = {
            ...profile,
            [key]: parsedVal
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setEditingUserDataKey('');
        setEditingUserDataVal('');
    };

    const handleDeleteUserData = (key) => {
        if (!connected) return;
        if (confirm(`Are you sure you want to delete profile property: "${key}"?`)) {
            const updatedProfile = { ...profile };
            delete updatedProfile[key];

            wsRef.current.send(JSON.stringify({
                type: 'settings:update_profile',
                profile: updatedProfile
            }));
        }
    };

    const handleAddAgentModel = (e) => {
        e.preventDefault();
        const key = newAgentKey.trim().toUpperCase();
        const val = newAgentVal.trim();
        if (!key || !val || !connected) return;

        const updatedAgentModels = {
            ...(profile.agent_models || {}),
            [key]: val
        };

        const updatedProfile = {
            ...profile,
            agent_models: updatedAgentModels
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setNewAgentKey('');
        setNewAgentVal('');
    };

    const handleSaveEditAgentModel = (key) => {
        if (!editingAgentVal.trim() || !connected) return;

        const updatedAgentModels = {
            ...(profile.agent_models || {}),
            [key]: editingAgentVal.trim()
        };

        const updatedProfile = {
            ...profile,
            agent_models: updatedAgentModels
        };

        wsRef.current.send(JSON.stringify({
            type: 'settings:update_profile',
            profile: updatedProfile
        }));

        setEditingAgentKey('');
        setEditingAgentVal('');
    };

    const handleDeleteAgentModel = (key) => {
        if (!connected) return;
        if (confirm(`Are you sure you want to delete agent model stage: "${key}"?`)) {
            const updatedAgentModels = { ...(profile.agent_models || {}) };
            delete updatedAgentModels[key];

            const updatedProfile = {
                ...profile,
                agent_models: updatedAgentModels
            };

            wsRef.current.send(JSON.stringify({
                type: 'settings:update_profile',
                profile: updatedProfile
            }));
        }
    };

    return (
        <div className="workbench-memory-layout-custom">
            {/* Section 1: Facts / Semantic Memory */}
            <div className="memory-section-card">
                <h3 className="section-title"><Database size={16} /> Persistent Fact Database</h3>
                <p className="section-desc">Aria extracts key facts about you during conversations. Manage or correct these statements below.</p>

                <form onSubmit={handleAddFact} className="memory-add-form">
                    <input
                        type="text"
                        className="memory-add-input"
                        placeholder="Enter a new statement..."
                        value={newFact}
                        onChange={(e) => setNewFact(e.target.value)}
                        required
                        disabled={!connected}
                    />
                    <button type="submit" className="memory-add-btn" disabled={!newFact.trim() || !connected}>
                        <Plus size={14} /> Add
                    </button>
                </form>

                <div className="memory-facts-list">
                    {facts.length === 0 ? (
                        <div className="facts-placeholder">
                            <Info size={18} className="text-slate" />
                            <span>No facts stored yet. Stored statements will appear here.</span>
                        </div>
                    ) : (
                        facts.map((fact, idx) => {
                            const displayFactText = typeof fact === 'object' && fact !== null ? fact.text || JSON.stringify(fact) : fact;
                            return (
                                <div key={idx} className="fact-item-card">
                                    {editingFactIndex === idx ? (
                                        <div className="fact-edit-row">
                                            <input
                                                type="text"
                                                className="fact-edit-input"
                                                value={editingFactText}
                                                onChange={(e) => setEditingFactText(e.target.value)}
                                            />
                                            <div className="fact-edit-actions">
                                                <button className="fact-action-btn success" onClick={() => handleSaveEditFact(idx)}>
                                                    Save
                                                </button>
                                                <button className="fact-action-btn cancel" onClick={() => setEditingFactIndex(-1)}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="fact-item-text">{displayFactText}</div>
                                            <div className="fact-item-actions">
                                                <button className="fact-icon-btn edit" onClick={() => { setEditingFactIndex(idx); setEditingFactText(displayFactText); }}>
                                                    <Edit3 size={14} />
                                                </button>
                                                <button className="fact-icon-btn delete" onClick={() => handleDeleteFact(idx)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Section 2: User Data Profile Configuration */}
            <div className="memory-section-card">
                <h3 className="section-title"><User size={16} /> User Context Attributes</h3>
                <p className="section-desc">Customize global profile key-value properties. Essential system properties are locked from deletion.</p>

                <form onSubmit={handleAddUserData} className="memory-add-form-kv">
                    <input
                        type="text"
                        placeholder="KEY (e.g. user_name)"
                        className="memory-add-input"
                        value={newUserDataKey}
                        onChange={(e) => setNewUserDataKey(e.target.value)}
                        required
                    />
                    <input
                        type="text"
                        placeholder="VALUE (e.g. John Doe)"
                        className="memory-add-input"
                        value={newUserDataVal}
                        onChange={(e) => setNewUserDataVal(e.target.value)}
                        required
                    />
                    <button type="submit" className="memory-add-btn" disabled={!newUserDataKey.trim() || !newUserDataVal.trim() || !connected}>
                        <Plus size={14} /> Add
                    </button>
                </form>

                <div className="memory-facts-list">
                    {Object.entries(profile || {})
                        .filter(([key]) => key !== 'known_facts' && key !== 'agent_models')
                        .map(([key, val]) => {
                            const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                            const isSystemKey = ['user_name', 'operating_system', 'preferred_programming_languages', 'preferences', 'workspace_dir'].includes(key);
                            return (
                                <div key={key} className="fact-item-card kv-card">
                                    {editingUserDataKey === key ? (
                                        <div className="fact-edit-row">
                                            <span className="fact-kv-key-label" title={key}>{key}</span>
                                            <input
                                                type="text"
                                                className="fact-edit-input"
                                                value={editingUserDataVal}
                                                onChange={(e) => setEditingUserDataVal(e.target.value)}
                                            />
                                            <div className="fact-edit-actions">
                                                <button className="fact-action-btn success" onClick={() => handleSaveEditUserData(key)}>
                                                    Save
                                                </button>
                                                <button className="fact-action-btn cancel" onClick={() => setEditingUserDataKey('')}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="fact-kv-details">
                                                <span className="fact-kv-key" title={key}>{key}</span>
                                                <span className="fact-kv-value" title={displayVal}>{displayVal}</span>
                                            </div>
                                            <div className="fact-item-actions">
                                                <button className="fact-icon-btn edit" onClick={() => { setEditingUserDataKey(key); setEditingUserDataVal(displayVal); }}>
                                                    <Edit3 size={14} />
                                                </button>
                                                {!isSystemKey && (
                                                    <button className="fact-icon-btn delete" onClick={() => handleDeleteUserData(key)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })
                    }
                </div>
            </div>

            {/* Section 3: Agent Data Configuration */}
            <div className="memory-section-card">
                <h3 className="section-title"><Network size={16} /> Agent Pipeline Models</h3>
                <p className="section-desc">View and manage model configurations assigned to pipeline stages.</p>

                <form onSubmit={handleAddAgentModel} className="memory-add-form-kv">
                    <input
                        type="text"
                        placeholder="STAGE (e.g. SUMMARY)"
                        className="memory-add-input uppercase"
                        value={newAgentKey}
                        onChange={(e) => setNewAgentKey(e.target.value)}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Ollama Model"
                        className="memory-add-input"
                        value={newAgentVal}
                        onChange={(e) => setNewAgentVal(e.target.value)}
                        required
                    />
                    <button type="submit" className="memory-add-btn" disabled={!newAgentKey.trim() || !newAgentVal.trim() || !connected}>
                        <Plus size={14} /> Add
                    </button>
                </form>

                <div className="memory-facts-list">
                    {Object.entries(profile?.agent_models || {})
                        .map(([key, val]) => {
                            const displayVal = String(val);
                            const isSystemKey = ['ROUTER', 'REACTIVE', 'COMPLEX', 'VERIFY'].includes(key);
                            return (
                                <div key={key} className="fact-item-card kv-card">
                                    {editingAgentKey === key ? (
                                        <div className="fact-edit-row">
                                            <span className="fact-kv-key-label" title={key}>{key}</span>
                                            <input
                                                type="text"
                                                className="fact-edit-input"
                                                value={editingAgentVal}
                                                onChange={(e) => setEditingAgentVal(e.target.value)}
                                            />
                                            <div className="fact-edit-actions">
                                                <button className="fact-action-btn success" onClick={() => handleSaveEditAgentModel(key)}>
                                                    Save
                                                </button>
                                                <button className="fact-action-btn cancel" onClick={() => setEditingAgentKey('')}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="fact-kv-details">
                                                <span className="fact-kv-key text-cyan" title={key}>{key}</span>
                                                <span className="fact-kv-value" title={displayVal}>{displayVal}</span>
                                            </div>
                                            <div className="fact-item-actions">
                                                <button className="fact-icon-btn edit" onClick={() => { setEditingAgentKey(key); setEditingAgentVal(displayVal); }}>
                                                    <Edit3 size={14} />
                                                </button>
                                                {!isSystemKey && (
                                                    <button className="fact-icon-btn delete" onClick={() => handleDeleteAgentModel(key)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
}

export default MemoryConsoleTab;
