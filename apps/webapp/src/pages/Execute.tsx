import { useState } from 'react';
import { ArrowLeftRight, Send, Fuel, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { executeSwap, executeTransfer } from '../api';

type TabType = 'swap' | 'transfer';
const TOKENS = ['USDC', 'SOL', 'BONK'] as const;

interface TxResult {
    signature: string;
    explorerUrl: string;
    inputAmount?: number;
    outputAmount?: number;
    inputToken?: string;
    outputToken?: string;
    token?: string;
    amount?: number;
    destination?: string;
}

export default function Execute() {
    const [tab, setTab] = useState<TabType>('swap');
    const [agentId, setAgentId] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TxResult | null>(null);
    const [error, setError] = useState('');

    // Swap
    const [inputToken, setInputToken] = useState('USDC');
    const [outputToken, setOutputToken] = useState('SOL');
    const [swapAmount, setSwapAmount] = useState('');
    const [slippage, setSlippage] = useState('50');

    // Transfer
    const [transferToken, setTransferToken] = useState('USDC');
    const [transferAmount, setTransferAmount] = useState('');
    const [destination, setDestination] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setResult(null); setLoading(true);
        try {
            if (tab === 'swap') {
                const res = await executeSwap(apiKey, {
                    inputToken, outputToken, amount: parseFloat(swapAmount), slippageBps: parseInt(slippage),
                });
                setResult(res);
            } else {
                const res = await executeTransfer(apiKey, {
                    token: transferToken, amount: parseFloat(transferAmount), destination,
                });
                setResult(res);
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string; code?: string } } };
            const d = e?.response?.data;
            setError(d?.code ? `${d.code}: ${d.message}` : d?.message || 'Request failed');
        }
        setLoading(false);
    };

    return (
        <div style={{ maxWidth: 540 }}>
            <div className="section-header">
                <div className="section-title">Execute Intent</div>
                <div className="section-sub">Submit a transaction intent on behalf of an AI agent</div>
            </div>

            <div className="card">
                {/* Auth */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>
                        Agent Identity
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Agent ID</label>
                            <input placeholder="agt-uuid…" value={agentId} onChange={e => setAgentId(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label>API Key</label>
                            <input type="password" placeholder="asgard_sk_…" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                        </div>
                    </div>
                </div>

                <hr className="divider" />

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    {(['swap', 'transfer'] as TabType[]).map(t => (
                        <button key={t}
                            className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                            onClick={() => { setTab(t); setResult(null); setError(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {t === 'swap' ? <ArrowLeftRight size={13} /> : <Send size={13} />}
                            <span className="hide-on-mobile">{t === 'swap' ? 'Swap' : 'Transfer'}</span>
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {tab === 'swap' ? (
                        <>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Sell</label>
                                    <select value={inputToken} onChange={e => setInputToken(e.target.value)}>
                                        {TOKENS.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Buy</label>
                                    <select value={outputToken} onChange={e => setOutputToken(e.target.value)}>
                                        {TOKENS.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Amount ({inputToken})</label>
                                    <input type="number" min="0" step="any" placeholder="0.00"
                                        value={swapAmount} onChange={e => setSwapAmount(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label>Slippage (bps)</label>
                                    <input type="number" min="1" max="1000" value={slippage} onChange={e => setSlippage(e.target.value)} />
                                </div>
                            </div>
                            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Fuel size={13} style={{ flexShrink: 0 }} />
                                Gas is sponsored by Kora — no SOL required in the agent wallet.
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Token</label>
                                    <select value={transferToken} onChange={e => setTransferToken(e.target.value)}>
                                        {TOKENS.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Amount</label>
                                    <input type="number" min="0" step="any" placeholder="0.00"
                                        value={transferAmount} onChange={e => setTransferAmount(e.target.value)} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Destination Address</label>
                                <input placeholder="Solana base58 public key…"
                                    value={destination} onChange={e => setDestination(e.target.value)} required minLength={32} maxLength={44} />
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="alert error" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <XCircle size={14} style={{ flexShrink: 0 }} /> {error}
                        </div>
                    )}

                    {result && (
                        <div className="alert success" style={{ marginTop: 8, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                <CheckCircle2 size={14} /> Transaction Confirmed
                            </div>
                            {result.inputAmount != null && (
                                <span>{result.inputAmount} {result.inputToken} → {result.outputAmount?.toFixed(6)} {result.outputToken}</span>
                            )}
                            {result.amount != null && (
                                <span>{result.amount} {result.token} → {result.destination?.slice(0, 12)}…</span>
                            )}
                            <a href={result.explorerUrl} target="_blank" rel="noreferrer"
                                style={{ color: 'var(--accent)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                View on Solana Explorer <ExternalLink size={11} />
                            </a>
                            <div className="mono" style={{ fontSize: 11, opacity: .7 }}>{result.signature}</div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary"
                        style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        disabled={loading || !agentId || !apiKey}>
                        {loading
                            ? <><Loader2 size={14} style={{ animation: 'spin .6s linear infinite' }} /> <span className="hide-on-mobile">Processing…</span></>
                            : tab === 'swap'
                                ? <><ArrowLeftRight size={14} /> <span className="hide-on-mobile">Submit Swap Intent</span></>
                                : <><Send size={14} /> <span className="hide-on-mobile">Submit Transfer Intent</span></>}
                    </button>
                </form>
            </div>
        </div>
    );
}
