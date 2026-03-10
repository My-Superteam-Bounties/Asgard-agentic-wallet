import { useState } from 'react';
import { Save, CheckCircle2, AlertTriangle, Github, FileText } from 'lucide-react';

export default function Settings() {
    const [apiUrl, setApiUrl] = useState(localStorage.getItem('asgard_url') || 'http://localhost:8017');
    const [nodeKey, setNodeKey] = useState((window as any).ASGARD_NODE_KEY || localStorage.getItem('asgard_node_key') || localStorage.getItem('asgard_admin_key') || '');
    const [network, setNetwork] = useState(localStorage.getItem('asgard_network') || 'devnet');
    const [saved, setSaved] = useState(false);

    const save = () => {
        localStorage.setItem('asgard_url', apiUrl);
        localStorage.setItem('asgard_node_key', nodeKey);
        localStorage.setItem('asgard_network', network);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div style={{ maxWidth: 540 }}>
            <div className="section-header">
                <div className="section-title">Settings</div>
                <div className="section-sub">Configure your Asgard Gateway connection</div>
            </div>

            {saved && (
                <div className="alert success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} /> Settings saved to browser storage.
                </div>
            )}

            <div className="card gap-16">
                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: .5 }}>
                        Gateway Connection
                    </div>
                    <div className="form-group">
                        <label>Asgard API URL</label>
                        <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="http://localhost:8017" />
                    </div>
                    <div className="form-group">
                        <label>Node Key</label>
                        <input type="password" value={nodeKey} onChange={e => setNodeKey(e.target.value)} placeholder="Your ASGARD_NODE_KEY" />
                    </div>
                    <div className="form-group">
                        <label>Network</label>
                        <select value={network} onChange={e => setNetwork(e.target.value)}>
                            <option value="devnet">Devnet</option>
                            <option value="mainnet-beta">Mainnet Beta</option>
                            <option value="localnet">Localnet</option>
                        </select>
                    </div>
                </div>

                <hr className="divider" style={{ margin: '4px 0' }} />

                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: .5 }}>
                        About
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
                        <div>Built for the Superteam AI Agent Wallet Bounty.</div>
                        <div>Architecture: API Gateway · AES-256-GCM Vault · Kora Gas Abstraction</div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                            <a href="https://github.com/your-org/asgard" target="_blank" rel="noreferrer"
                                style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Github size={13} /> GitHub
                            </a>
                            <a href="#" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <FileText size={13} /> DESIGN.md
                            </a>
                            <a href="#" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <FileText size={13} /> SKILLS.md
                            </a>
                        </div>
                    </div>
                </div>

                <div>
                    <button className="btn btn-primary" onClick={save}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Save size={13} /> <span className="hide-on-mobile">Save Settings</span>
                    </button>
                </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                Settings are stored in your browser's local storage. Do not store production node keys in a shared browser.
            </div>
        </div>
    );
}
