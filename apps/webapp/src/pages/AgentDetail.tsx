import { useState, useEffect } from 'react';
import { ArrowLeft, Edit3, Shield, Activity, RefreshCw, X, Save, Clock, AlertTriangle } from 'lucide-react';
import { fetchAgentDetails, fetchAgentBalance, fetchAgentHistory, updateAgentPolicy } from '../api';

interface AgentDetailProps {
    agentId: string;
    onBack: () => void;
}

export default function AgentDetail({ agentId, onBack }: AgentDetailProps) {
    const [agent, setAgent] = useState<any>(null);
    const [balance, setBalance] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [isEditingPolicy, setIsEditingPolicy] = useState(false);
    const [policyForm, setPolicyForm] = useState<any>({});
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [agRes, balRes, histRes] = await Promise.all([
                    fetchAgentDetails(agentId),
                    fetchAgentBalance(agentId),
                    fetchAgentHistory(agentId)
                ]);
                setAgent(agRes);
                setBalance(balRes.balances);
                setHistory(histRes.history || []);

                // Initialize form state
                setPolicyForm({
                    maxDailySpendUSDC: agRes.customPolicy?.maxDailySpendUSDC ?? '',
                    maxSingleTxUSDC: agRes.customPolicy?.maxSingleTxUSDC ?? '',
                    maxTransactionsPerMinute: agRes.customPolicy?.maxTransactionsPerMinute ?? '',
                    maxTransactionsPerDay: agRes.customPolicy?.maxTransactionsPerDay ?? '',
                    allowTransfers: agRes.customPolicy?.allowTransfers ?? true,
                    allowSwaps: agRes.customPolicy?.allowSwaps ?? true,
                });
            } catch (err: any) {
                console.error(err);
                setErrorMsg('Failed to load agent details. Make sure you are using an Admin key.');
            }
            setLoading(false);
        };
        loadData();
    }, [agentId]);

    const handleSavePolicy = async () => {
        setSaving(true);
        setErrorMsg('');
        try {
            // Clean empty strings so we don't send malformed numbers
            const payload: any = {};
            if (policyForm.maxDailySpendUSDC !== '') payload.maxDailySpendUSDC = Number(policyForm.maxDailySpendUSDC);
            if (policyForm.maxSingleTxUSDC !== '') payload.maxSingleTxUSDC = Number(policyForm.maxSingleTxUSDC);
            if (policyForm.maxTransactionsPerMinute !== '') payload.maxTransactionsPerMinute = Number(policyForm.maxTransactionsPerMinute);
            if (policyForm.maxTransactionsPerDay !== '') payload.maxTransactionsPerDay = Number(policyForm.maxTransactionsPerDay);

            payload.allowTransfers = Boolean(policyForm.allowTransfers);
            payload.allowSwaps = Boolean(policyForm.allowSwaps);

            await updateAgentPolicy(agentId, payload);
            setIsEditingPolicy(false);

            // Reload agent data eagerly
            const agRes = await fetchAgentDetails(agentId);
            setAgent(agRes);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || 'Failed to update policy.');
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-[var(--accent)] mt-8 slide-up">
                <RefreshCw size={32} className="animate-spin mb-4" />
                <p>Loading Deep Logs...</p>
            </div>
        );
    }

    if (!agent && errorMsg) {
        return (
            <div className="card p-6 border-red-500/30 bg-red-500/5 slide-up">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                    <AlertTriangle size={18} />
                    <strong>Error</strong>
                </div>
                <p className="text-[var(--text-muted)]">{errorMsg}</p>
                <button className="btn mt-4" onClick={onBack}>
                    <ArrowLeft size={16} /> Back to Agents
                </button>
            </div>
        );
    }

    return (
        <div className="agent-detail-page slide-up space-y-6">
            <div className="flex items-center justify-between mb-4">
                <button className="btn btn-ghost flex items-center gap-2 hover:bg-white/5 transition-all text-white/70 hover:text-white" onClick={onBack}>
                    <ArrowLeft size={16} /> Back to Fleet
                </button>
            </div>

            {/* HERO IDENTITY CARD */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-black/20 p-8 backdrop-blur-xl shadow-2xl">
                <div className="absolute top-0 right-0 p-6">
                    <div className={`status-indicator ${agent.active ? 'active shadow-[0_0_15px_rgba(52,211,153,0.5)] bg-emerald-400' : 'inactive bg-red-500'}`} />
                </div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-[1px] shadow-xl shadow-indigo-500/20">
                        <div className="w-full h-full rounded-2xl bg-[#0a0b0f] flex items-center justify-center text-white">
                            <Shield size={36} className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-400" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-3xl font-bold tracking-tight text-white">{agent.name}</h2>
                            <span className="text-xs px-2.5 py-1 rounded-md bg-white/10 border border-white/10 font-mono font-semibold text-purple-300 backdrop-blur-md uppercase tracking-wider">
                                {agent.policyProfile}
                            </span>
                        </div>
                        <p className="text-xs text-indigo-300/60 font-mono tracking-widest uppercase mb-1.5 mt-2">Vault Address</p>
                        <p className="text-sm text-white/80 font-mono truncate max-w-md bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
                            {agent.publicKey}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COL: Header & Balances */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">

                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2 ml-1">
                            <Activity size={14} className="text-blue-400" /> Live Balances
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {balance ? Object.entries(balance).map(([ticker, amount], idx) => (
                                <div key={ticker} className="relative overflow-hidden group rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.04] hover:border-white/10 transition-all flex justify-between items-center backdrop-blur-md">
                                    <div className={`absolute -left-10 w-20 h-20 rounded-full blur-[40px] opacity-20 ${idx % 2 === 0 ? 'bg-blue-500' : 'bg-emerald-500'} group-hover:opacity-40 transition-opacity`}></div>
                                    <span className="font-semibold text-white/90 relative z-10 text-base">{ticker}</span>
                                    <span className="font-mono text-xl text-white relative z-10 drop-shadow-md">
                                        {Number(amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                    </span>
                                </div>
                            )) : <p className="text-sm text-white/40 italic p-4 bg-white/[0.02] rounded-xl border border-white/5">Scanning vault reserves...</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="p-4 bg-gradient-to-br from-white/5 to-transparent rounded-xl border border-white/5 backdrop-blur-sm relative overflow-hidden group hover:border-white/10 transition-all">
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-500 to-orange-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1.5 font-semibold">24h USD Vol</div>
                            <div className="font-mono text-2xl font-bold text-white shadow-sm">${agent.usage?.dailySpendUSDC || 0}</div>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-white/5 to-transparent rounded-xl border border-white/5 backdrop-blur-sm relative overflow-hidden group hover:border-white/10 transition-all">
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1.5 font-semibold">Daily Executions</div>
                            <div className="font-mono text-2xl font-bold text-white shadow-sm">{agent.usage?.dailyTxCount || 0}</div>
                        </div>
                    </div>

                    {/* POLICY OVERRIDE CONFIGURATOR */}
                    <div className="rounded-2xl border border-white/5 bg-[#111318]/80 backdrop-blur-xl relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] pointer-events-none"></div>

                        <div className="p-5 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-white/90">
                                <Shield size={16} className="text-emerald-400" /> Operational Limits
                            </h3>
                            {!isEditingPolicy ? (
                                <button className="btn btn-ghost text-xs py-1.5 px-3 h-auto hover:bg-white/10 text-white/70" onClick={() => setIsEditingPolicy(true)}>
                                    <Edit3 size={14} /> Tweak
                                </button>
                            ) : (
                                <button className="btn btn-ghost text-xs py-1.5 px-3 h-auto text-red-400 hover:bg-red-500/20" onClick={() => setIsEditingPolicy(false)}>
                                    <X size={14} /> Cancel
                                </button>
                            )}
                        </div>

                        <div className="p-5">
                            {errorMsg && <div className="text-xs text-red-200 mb-4 bg-red-500/20 border border-red-500/30 p-3 rounded-lg backdrop-blur-md">{errorMsg}</div>}

                            <div className="space-y-4 text-sm">
                                <div className="space-y-3">
                                    {[
                                        { label: 'Daily Spend Max ($)', key: 'maxDailySpendUSDC' },
                                        { label: 'Single Tx Max ($)', key: 'maxSingleTxUSDC' },
                                        { label: 'Daily Txs Limit', key: 'maxTransactionsPerDay' }
                                    ].map(({ label, key }) => (
                                        <label key={key} className="flex flex-col gap-1.5 group">
                                            <span className="text-white/50 text-[10px] uppercase font-semibold tracking-wider ml-1">{label}</span>
                                            {isEditingPolicy ? (
                                                <input type="number"
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/20 shadow-inner"
                                                    value={policyForm[key]}
                                                    onChange={e => setPolicyForm({ ...policyForm, [key]: e.target.value })}
                                                    placeholder="Inherit Baseline"
                                                />
                                            ) : (
                                                <div className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5 font-mono text-white/90">
                                                    {agent.customPolicy?.[key] ?? <span className="text-white/30 italic">Inherit Baseline</span>}
                                                </div>
                                            )}
                                        </label>
                                    ))}
                                </div>

                                <div className="pt-5 mt-2 border-t border-white/5 grid grid-cols-2 gap-3">
                                    <label className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${policyForm.allowSwaps ? 'border-purple-500/30 bg-purple-500/10 text-purple-200 shadow-[inset_0_0_15px_rgba(168,85,247,0.1)]' : 'border-white/5 bg-white/[0.02] text-white/40'} ${!isEditingPolicy ? 'cursor-default' : 'cursor-pointer hover:border-purple-500/50'}`}>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Swaps</span>
                                        <input type="checkbox" disabled={!isEditingPolicy} className="hidden" checked={policyForm.allowSwaps} onChange={e => setPolicyForm({ ...policyForm, allowSwaps: e.target.checked })} />
                                        <div className={`w-8 h-4 rounded-full transition-colors relative ${policyForm.allowSwaps ? 'bg-purple-500' : 'bg-white/20'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${policyForm.allowSwaps ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                    </label>

                                    <label className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${policyForm.allowTransfers ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]' : 'border-white/5 bg-white/[0.02] text-white/40'} ${!isEditingPolicy ? 'cursor-default' : 'cursor-pointer hover:border-emerald-500/50'}`}>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Transfers</span>
                                        <input type="checkbox" disabled={!isEditingPolicy} className="hidden" checked={policyForm.allowTransfers} onChange={e => setPolicyForm({ ...policyForm, allowTransfers: e.target.checked })} />
                                        <div className={`w-8 h-4 rounded-full transition-colors relative ${policyForm.allowTransfers ? 'bg-emerald-500' : 'bg-white/20'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${policyForm.allowTransfers ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {isEditingPolicy && (
                                <button className="w-full mt-6 py-3 rounded-xl font-bold tracking-wide text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all flex items-center justify-center gap-2" onClick={handleSavePolicy} disabled={saving}>
                                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                    {saving ? 'Synchronizing...' : 'Enforce Protocol'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COL: History Table */}
                <div className="col-span-1 lg:col-span-8 flex flex-col min-h-[500px]">
                    <div className="rounded-2xl border border-white/5 bg-[#111318]/80 backdrop-blur-xl flex flex-col h-full overflow-hidden shadow-xl">
                        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-white/90">
                                <Clock size={16} className="text-indigo-400" /> Execution Ledger
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-white/40 border border-white/5 bg-white/5 px-2 py-0.5 rounded-full shadow-inner font-mono">20 max</span>
                                <div className="flex items-center gap-1.5 ml-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></div>
                                    <span className="text-[10px] text-emerald-400/80 uppercase tracking-widest font-bold">Online</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-white/30">
                                    <Activity size={48} className="opacity-20 mb-4 text-indigo-400" />
                                    <p className="font-mono text-sm shadow-sm">Awaiting first execution block...</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="sticky top-0 bg-[#0a0b0f]/95 backdrop-blur-sm z-10 shadow-md">
                                        <tr className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                                            <th className="px-6 py-4">Signature</th>
                                            <th className="px-6 py-4">Operation</th>
                                            <th className="px-6 py-4">Block Time</th>
                                            <th className="px-6 py-4 text-right">Fee (SOL)</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {history.map((tx) => (
                                            <tr key={tx.signature} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-6 py-4 font-mono text-xs">
                                                    <a href={tx.explorerUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200 hover:underline flex items-center gap-1.5 transition-colors">
                                                        {tx.signature.substring(0, 16)}...
                                                    </a>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border backdrop-blur-sm ${tx.typeHint?.includes('Swap') ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 shadow-[inset_0_0_8px_rgba(168,85,247,0.1)]' : 'border-blue-500/30 bg-blue-500/10 text-blue-300 shadow-[inset_0_0_8px_rgba(59,130,246,0.1)]'}`}>
                                                        {tx.typeHint || 'Transfer'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-white/50 text-xs font-mono">
                                                    {tx.blockTime ? new Date(tx.blockTime).toLocaleString() : <span className="text-yellow-400/80 animate-pulse">Pending...</span>}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-right text-white/60">
                                                    {(tx.fee / 1e9).toFixed(5)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        {tx.err ? (
                                                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" title="Failed"></div>
                                                        ) : (
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" title="Success"></div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
