import { useState, useEffect } from 'react';
import {
    Plus, Bot, Copy, CheckCircle2, XCircle,
    TrendingUp, TrendingDown, Layers, Eye, EyeOff,
    AlertTriangle,
} from 'lucide-react';
import { fetchAgents, provisionAgent, type Agent } from '../api';
import AgentDetail from './AgentDetail';

import type { AsgardEvent } from '../hooks/useSocket';

function shortAddr(addr: string) {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—';
}

interface Props {
    socketEvents?: AsgardEvent[];
}

export default function Agents({ socketEvents = [] }: Props) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [result, setResult] = useState<{ apiKey: string; agentId: string; walletAddress: string } | null>(null);
    const [form, setForm] = useState({ name: '', policyProfile: 'default' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const copy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 1500);
    };

    const load = async () => {
        setLoading(true);
        try { setAgents(await fetchAgents()); } catch { setAgents([]); }
        setLoading(false);
    };

    useEffect(() => { void load(); }, []);

    // Listen for real-time agent provisioning events
    useEffect(() => {
        if (!socketEvents.length) return;
        const latest = socketEvents[0];
        if (latest.type === 'agent:provisioned') {
            void load();
        }
    }, [socketEvents]);

    const handleProvision = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true); setError('');
        try {
            const res = await provisionAgent(form.name, form.policyProfile);
            setResult(res);
            await load();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to provision agent';
            setError(msg);
        }
        setSubmitting(false);
    };

    const pillClass = (p: string) => p === 'high_volume' ? 'yellow' : p === 'read_only' ? 'blue' : 'green';
    const PillIcon = ({ p }: { p: string }) =>
        p === 'high_volume' ? <TrendingUp size={10} style={{ marginRight: 3 }} />
            : p === 'read_only' ? <Layers size={10} style={{ marginRight: 3 }} />
                : <TrendingDown size={10} style={{ marginRight: 3 }} />;

    if (selectedAgentId) {
        return <AgentDetail agentId={selectedAgentId} onBack={() => setSelectedAgentId(null)} />;
    }

    return (
        <div className="gap-16">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div className="section-title">Agent Wallets</div>
                    <div className="section-sub">{agents.length} registered</div>
                </div>
                <button className="btn btn-primary" onClick={() => { setShowModal(true); setResult(null); setError(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={14} /> <span className="hide-on-mobile">New Agent</span>
                </button>
            </div>

            {/* Agents table */}
            <div className="card">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
                ) : agents.length === 0 ? (
                    <div className="empty">
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                            <Bot size={36} strokeWidth={1} style={{ opacity: .3 }} />
                        </div>
                        No agents yet. Provision your first agent to get started.
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th><th>Wallet</th><th>Policy</th><th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agents.map(a => (
                                    <tr key={a.agentId}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{a.name}</div>
                                            <div className="mono" style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{a.agentId.slice(0, 18)}…</div>
                                        </td>
                                        <td>
                                            <span className="addr" onClick={() => copy(a.publicKey, a.agentId)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                {shortAddr(a.publicKey)}
                                                {copied === a.agentId ? <CheckCircle2 size={11} /> : <Copy size={11} style={{ opacity: .5 }} />}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`pill ${pillClass(a.policyProfile)}`}>
                                                <PillIcon p={a.policyProfile} />
                                                {a.policyProfile}
                                            </span>
                                        </td>
                                        <td className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>
                                            {new Date(a.createdAt).toLocaleDateString()}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-ghost" onClick={() => setSelectedAgentId(a.agentId)} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="hide-on-mobile">View</span> <Eye size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}</tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Provision modal */}
            {showModal && (
                <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="modal">
                        {result ? (
                            <>
                                <div className="modal-title" style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle2 size={18} /> Agent Provisioned
                                </div>
                                <div className="alert success" style={{ alignItems: 'flex-start' }}>
                                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                    New wallet created. Save your API Key — it will not be shown again.
                                </div>
                                <div className="form-group">
                                    <label>Agent ID</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input readOnly value={result.agentId} />
                                        <button className="btn btn-ghost btn-sm" onClick={() => copy(result.agentId, 'agentId')}
                                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {copied === 'agentId' ? <CheckCircle2 size={12} /> : <Copy size={12} />} <span className="hide-on-mobile">Copy</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Wallet Address</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input readOnly value={result.walletAddress} />
                                        <button className="btn btn-ghost btn-sm" onClick={() => copy(result.walletAddress, 'wallet')}
                                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {copied === 'wallet' ? <CheckCircle2 size={12} /> : <Copy size={12} />} <span className="hide-on-mobile">Copy</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>API Key</span>
                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                                            onClick={() => setShowKey(v => !v)}>
                                            {showKey ? <EyeOff size={12} /> : <Eye size={12} />} {showKey ? 'Hide' : 'Show'}
                                        </button>
                                    </label>
                                    <div className="api-key-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                        <span style={{ wordBreak: 'break-all' }}>{showKey ? result.apiKey : '•'.repeat(40)}</span>
                                        <button className="btn btn-ghost btn-sm" onClick={() => copy(result.apiKey, 'apikey')}
                                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {copied === 'apikey' ? <CheckCircle2 size={12} /> : <Copy size={12} />} <span className="hide-on-mobile">Copy</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-primary" onClick={() => setShowModal(false)}>Done</button>
                                </div>
                            </>
                        ) : (
                            <form onSubmit={handleProvision}>
                                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Plus size={18} /> Provision New Agent
                                </div>
                                {error && (
                                    <div className="alert error">
                                        <XCircle size={14} style={{ flexShrink: 0 }} /> {error}
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Agent Name</label>
                                    <input placeholder="e.g. TradingBot-Alpha" value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label>Policy Profile</label>
                                    <select value={form.policyProfile} onChange={e => setForm(f => ({ ...f, policyProfile: e.target.value }))}>
                                        <option value="default">Default — $50 USDC/day</option>
                                        <option value="high_volume">High Volume — $500 USDC/day</option>
                                        <option value="read_only">Read Only — no transactions</option>
                                    </select>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {submitting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> <span className="hide-on-mobile">Creating…</span></> : <><Plus size={13} /> <span className="hide-on-mobile">Create Agent</span></>}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
