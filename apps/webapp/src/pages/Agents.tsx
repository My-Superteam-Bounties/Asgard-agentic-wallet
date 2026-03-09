import { useState, useEffect } from 'react';
import {
    Plus, Bot, Copy, CheckCircle2, XCircle,
    TrendingUp, TrendingDown, Layers, Wallet, Eye, EyeOff,
    AlertTriangle,
} from 'lucide-react';
import { fetchAgents, provisionAgent, fetchBalance, fetchHistory, type Agent, type Balances } from '../api';

import type { AsgardEvent } from '../hooks/useSocket';

function shortAddr(addr: string) {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—';
}

interface BalanceState { address: string; balances: Balances; history: any[] }

interface Props {
    socketEvents?: AsgardEvent[];
}

export default function Agents({ socketEvents = [] }: Props) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [result, setResult] = useState<{ apiKey: string; agentId: string; walletAddress: string } | null>(null);
    const [balances, setBalances] = useState<Record<string, BalanceState>>({});
    const [watchKey, setWatchKey] = useState('');
    const [watchId, setWatchId] = useState('');
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

    const handleCheckBalance = async () => {
        if (!watchId || !watchKey) return;
        setError('');
        try {
            const [b, h] = await Promise.all([
                fetchBalance(watchId, watchKey),
                fetchHistory(watchId, watchKey, 5) // Fetch last 5 transactions
            ]);
            setBalances(prev => ({ ...prev, [watchId]: { ...b, history: h.history || [] } }));
        } catch {
            setError('Failed to fetch balance. Check Agent ID and API key.');
        }
    };

    const pillClass = (p: string) => p === 'high_volume' ? 'yellow' : p === 'read_only' ? 'blue' : 'green';
    const PillIcon = ({ p }: { p: string }) =>
        p === 'high_volume' ? <TrendingUp size={10} style={{ marginRight: 3 }} />
            : p === 'read_only' ? <Layers size={10} style={{ marginRight: 3 }} />
                : <TrendingDown size={10} style={{ marginRight: 3 }} />;

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
                    <Plus size={14} /> New Agent
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
                                                <PillIcon p={a.policyProfile} />{a.policyProfile}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--muted)' }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Balance checker */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Wallet size={14} /> Check Balance & History
                    </span>
                </div>
                <div className="form-row">
                    <div className="form-group" style={{ margin: 0 }}>
                        <label>Agent ID</label>
                        <input placeholder="agt-uuid…" value={watchId} onChange={e => setWatchId(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label>Agent API Key</label>
                        <input type="password" placeholder="asgard_sk_…" value={watchKey} onChange={e => setWatchKey(e.target.value)} />
                    </div>
                </div>
                {error && (
                    <div className="alert error" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {error}
                    </div>
                )}
                {watchId && balances[watchId] && (
                    <>
                        <div className="alert info" style={{ marginTop: 12, gap: 16, flexWrap: 'wrap' }}>
                            <span className="mono">{shortAddr(balances[watchId].address)}</span>
                            {Object.entries(balances[watchId].balances).map(([t, v]) => (
                                <span key={t}><strong>{t}</strong>: {Number(v).toFixed(4)}</span>
                            ))}
                        </div>

                        {balances[watchId].history.length > 0 && (
                            <div className="table-wrap" style={{ marginTop: 12 }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Status</th>
                                            <th>Time</th>
                                            <th>Signature</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {balances[watchId].history.map((tx, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    {tx.err ? (
                                                        <span style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <XCircle size={12} /> Failed
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <CheckCircle2 size={12} /> Success
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                                                    {tx.blockTime ? new Date(tx.blockTime).toLocaleString() : 'Recent'}
                                                </td>
                                                <td>
                                                    <a href={tx.explorerUrl} target="_blank" rel="noreferrer"
                                                        style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        {shortAddr(tx.signature)} <Eye size={12} />
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {balances[watchId].history.length === 0 && (
                            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)', marginTop: 12, background: 'var(--surface2)', borderRadius: 8, textAlign: 'center' }}>
                                No transactions found for this wallet.
                            </div>
                        )}
                    </>
                )}
                <button className="btn btn-primary" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={handleCheckBalance} disabled={!watchId || !watchKey}>
                    <Wallet size={13} /> Fetch Data
                </button>
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
                                            {copied === 'agentId' ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Wallet Address</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input readOnly value={result.walletAddress} />
                                        <button className="btn btn-ghost btn-sm" onClick={() => copy(result.walletAddress, 'wallet')}
                                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {copied === 'wallet' ? <CheckCircle2 size={12} /> : <Copy size={12} />}
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
                                            {copied === 'apikey' ? <CheckCircle2 size={12} /> : <Copy size={12} />}
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
                                        {submitting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Creating…</> : <><Plus size={13} /> Create Agent</>}
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
