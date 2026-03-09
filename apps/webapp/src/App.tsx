import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Bot, Zap, Settings as SettingsIcon,
  RefreshCw, Wifi, WifiOff, Sun, Moon
} from 'lucide-react';
import './index.css';
import { fetchHealth, type GatewayHealth } from './api';
import { useSocket } from './hooks/useSocket';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Execute from './pages/Execute';
import Settings from './pages/Settings';

type Page = 'dashboard' | 'agents' | 'execute' | 'settings';

const NAV: { id: Page; icon: React.ReactNode; label: string }[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { id: 'agents', icon: <Bot size={16} />, label: 'Agents' },
  { id: 'execute', icon: <Zap size={16} />, label: 'Execute' },
  { id: 'settings', icon: <SettingsIcon size={16} />, label: 'Settings' },
];

const PAGE_TITLES: Record<Page, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Live overview of your Asgard deployment' },
  agents: { title: 'Agents', sub: 'Manage and monitor AI agent wallets' },
  execute: { title: 'Execute Intent', sub: 'Submit swap or transfer on behalf of an agent' },
  settings: { title: 'Settings', sub: 'Configure gateway connection and admin key' },
};

export default function App() {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('asgard_theme') as 'dark' | 'light') || 'dark'
  );

  const [page, setPageState] = useState<Page>(() => {
    const p = new URLSearchParams(window.location.search).get('page');
    return (p && Object.keys(PAGE_TITLES).includes(p)) ? (p as Page) : 'dashboard';
  });

  const setPage = (p: Page) => {
    setPageState(p);
    window.history.replaceState(null, '', `?page=${p}`);
  };
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [online, setOnline] = useState(false);

  // Real-time Socket.IO event stream
  const { connected: socketConnected, events: socketEvents, clearEvents } = useSocket();

  const checkHealth = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
      setOnline(true);
    } catch {
      setOnline(false);
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('asgard_theme', theme);
  }, [theme]);

  useEffect(() => {
    // Artificial 1.2s delay for the splash screen presentation
    const timer = setTimeout(() => setIsAppLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const { title, sub } = PAGE_TITLES[page];

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <>
      <div className={`app-loader ${!isAppLoading ? 'hidden' : ''}`}>
        <div />
        <div className="app-loader-center">
          <img src="/favicon_io/android-chrome-192x192.png" alt="Asgard Logo" className="loader-logo" />
          <div className="app-loader-title">Asgard Wallet</div>
          <div className="app-loader-subtitle">The ultimate secure agentic wallet</div>
        </div>
        <div className="app-loader-bottom">
          Powered by <span>Solana</span> &amp; <span>Superteam Nigeria</span>
        </div>
      </div>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">
              <img src="/favicon_io/android-chrome-192x192.png" alt="Asgard Logo" style={{ width: 32, height: 32, borderRadius: '25%' }} />
              <div>
                <div className="logo-text">Asgard</div>
                <div className="logo-sub">Agent Wallet</div>
              </div>
            </div>
          </div>

          <div className="sidebar-section-label">Navigation</div>
          <nav className="sidebar-nav">
            {NAV.map(n => (
              <button
                key={n.id}
                className={`nav-item${page === n.id ? ' active' : ''}`}
                onClick={() => setPage(n.id)}
              >
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="gateway-badge">
              <div className={`gateway-dot${online ? '' : ' offline'}`} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {online
                    ? <Wifi size={12} style={{ color: 'var(--green)' }} />
                    : <WifiOff size={12} style={{ color: 'var(--red)' }} />}
                  {online ? 'Gateway Online' : 'Gateway Offline'}
                </div>
                {health && <div style={{ marginTop: 2, opacity: .6, fontSize: 11 }}>{health.network}</div>}
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="main">
          <header className="topbar">
            <div>
              <div className="topbar-title">{title}</div>
              <div className="topbar-sub">{sub}</div>
            </div>
            <div className="topbar-actions">
              <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title="Toggle Theme" style={{ padding: '6px 10px' }}>
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { void checkHealth(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </header>

          <div className="page-content">
            {page === 'dashboard' && <Dashboard health={health} online={online} socketConnected={socketConnected} socketEvents={socketEvents} clearEvents={clearEvents} />}
            {page === 'agents' && <Agents socketEvents={socketEvents} />}
            {page === 'execute' && <Execute />}
            {page === 'settings' && <Settings />}
          </div>
        </div>
      </div>
    </>
  );
}
