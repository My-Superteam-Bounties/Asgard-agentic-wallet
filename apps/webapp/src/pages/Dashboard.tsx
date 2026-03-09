import { useState, useEffect } from 'react';
import {
    Bot, ShieldCheck, Layers, Fuel,
    TrendingUp, TrendingDown, Copy, CheckCircle2, XCircle,
} from 'lucide-react';
import { fetchAgents, type Agent, type GatewayHealth } from '../api';
import ActivityFeed from '../components/ActivityFeed';
import type { AsgardEvent } from '../hooks/useSocket';

interface Props {
    health: GatewayHealth | null;
    online: boolean;
    socketConnected: boolean;
    socketEvents: AsgardEvent[];
    clearEvents: () => void;
}

function shortAddr(addr: string) {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—';
}

export default function Dashboard({ health, online, socketConnected, socketEvents, clearEvents }: Props) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        fetchAgents()
            .then(setAgents)
            .catch(() => setAgents([]))
            .finally(() => setLoading(false));
    }, []);

    // Listen for real-time agent provisioning events
    useEffect(() => {
        if (!socketEvents.length) return;
        const latest = socketEvents[0];
        if (latest.type === 'agent:provisioned') {
            fetchAgents().then(setAgents).catch(console.error);
        }
    }, [socketEvents]);

    const active = agents.filter(a => a.active).length;
    const profiles: Record<string, number> = {};
    agents.forEach(a => { profiles[a.policyProfile] = (profiles[a.policyProfile] || 0) + 1; });

    const copyAddr = (addr: string) => {
        navigator.clipboard.writeText(addr);
        setCopied(addr);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <div>
            {!online && (
                <div className="alert error" style={{ marginBottom: 24 }}>
                    <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    Cannot reach the Asgard Gateway. Make sure the API server is running at{' '}
                    <code>{localStorage.getItem('asgard_url') || import.meta.env.VITE_API_URL || 'http://localhost:8017'}</code>.
                </div>
            )}

            {/* Stats row */}
            <div className="stats-grid">
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Total Agents</span>
                        <div className="stat-icon blue"><Bot size={17} /></div>
                    </div>
                    <div className="card-value">{loading ? '—' : agents.length}</div>
                    <div className="card-sub">{active} active</div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Gateway</span>
                        <div className={`stat-icon ${online ? 'green' : 'red'}`}>
                            {online ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                        </div>
                    </div>
                    <div className="card-value" style={{ fontSize: 18, paddingTop: 6, color: online ? 'var(--green)' : 'var(--red)' }}>
                        {online ? 'Online' : 'Offline'}
                    </div>
                    <div className="card-sub">{health?.network || 'unknown'} · v{health?.version || '?'}</div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Policy Profiles</span>
                        <div className="stat-icon yellow"><ShieldCheck size={17} /></div>
                    </div>
                    <div className="card-value">{Object.keys(profiles).length || '—'}</div>
                    <div className="card-sub">
                        {Object.entries(profiles).map(([k, v]) => `${k} (${v})`).join(' · ') || 'No agents yet'}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Gas Model</span>
                        <div className="stat-icon purple"><Fuel size={17} /></div>
                    </div>
                    <div className="card-value" style={{ fontSize: 18, paddingTop: 6 }}>Kora</div>
                    <div className="card-sub">SPL-token sponsored fees</div>
                </div>
            </div>

            {/* Recent agents table */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Registered Agents</span>
                    {loading && <div className="spinner" />}
                </div>
                {agents.length === 0 && !loading ? (
                    <div className="empty">
                        <div className="empty-icon"><Bot size={36} strokeWidth={1} style={{ opacity: .3, margin: '0 auto' }} /></div>
                        No agents provisioned yet. Go to the Agents page to create one.
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Wallet Address</th>
                                    <th>Policy</th>
                                    <th>Created</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agents.map(a => (
                                    <tr key={a.agentId}>
                                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                                        <td>
                                            <span
                                                className="addr"
                                                title="Click to copy"
                                                onClick={() => copyAddr(a.publicKey)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                            >
                                                {shortAddr(a.publicKey)}
                                                {copied === a.publicKey
                                                    ? <CheckCircle2 size={11} />
                                                    : <Copy size={11} style={{ opacity: .5 }} />}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`pill ${a.policyProfile === 'high_volume' ? 'yellow' : a.policyProfile === 'read_only' ? 'blue' : 'green'}`}>
                                                {a.policyProfile === 'high_volume' && <TrendingUp size={10} style={{ marginRight: 3 }} />}
                                                {a.policyProfile === 'read_only' && <Layers size={10} style={{ marginRight: 3 }} />}
                                                {a.policyProfile === 'default' && <TrendingDown size={10} style={{ marginRight: 3 }} />}
                                                {a.policyProfile}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--muted)' }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <span className={`pill ${a.active ? 'green' : 'red'}`}>
                                                {a.active
                                                    ? <><CheckCircle2 size={10} style={{ marginRight: 3 }} />Active</>
                                                    : <><XCircle size={10} style={{ marginRight: 3 }} />Inactive</>}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Live Activity Feed */}
            <ActivityFeed events={socketEvents} connected={socketConnected} clearEvents={clearEvents} />
        </div>
    );
}
