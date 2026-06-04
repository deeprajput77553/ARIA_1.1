import { MessageSquare, Cpu, History, Settings, Rocket, Wifi, WifiOff, Radio } from 'lucide-react';

function Navbar({ activePage, setActivePage, connected, workspaceDir }) {
    const navItems = [
        { id: 'orb', label: 'Orb', icon: <Radio size={18} /> },
        { id: 'chat', label: 'Messages', icon: <MessageSquare size={18} /> },
        { id: 'workbench', label: 'Workbench', icon: <Cpu size={18} /> },
        { id: 'history', label: 'Traces & History', icon: <History size={18} /> },
        { id: 'settings', label: 'Settings', icon: <Settings size={18} /> }
    ];

    return (
        <aside className="navbar-sidebar">
            <div className="navbar-brand brand-image-mode">
                                <img src="/aria_logo.svg" alt="Aria Logo" className="navbar-logo-image" />
            </div>

            <nav className="navbar-menu">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`navbar-item ${activePage === item.id ? 'active' : ''}`}
                        onClick={() => {
                            window.playUISound('click');
                            setActivePage(item.id);
                        }}
                    >
                        <span className="navbar-icon">{item.icon}</span>
                        <span className="navbar-label">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="navbar-footer">
                <div className="workspace-badge" title={workspaceDir}>
                    <span className="badge-title">Workspace</span>
                    <span className="badge-value">
                        {workspaceDir ? workspaceDir.split(/[\\/]/).pop() || workspaceDir : 'Not Set'}
                    </span>
                </div>

                <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                    {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span className="status-text">{connected ? 'Connected (Live)' : 'Reconnecting...'}</span>
                </div>
            </div>
        </aside>
    );
}

export default Navbar;
