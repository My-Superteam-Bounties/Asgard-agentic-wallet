/**
 * ActivityFeed.tsx
 * Real-time event feed showing live agent interactions from the Asgard daemon.
 * Displays swap, transfer, provision, balance, and policy events.
 */

import { useState } from 'react';
import {
    Activity, ArrowRightLeft, Send, Bot, Wallet,
    ShieldAlert, Radio, Clock, ChevronDown, ChevronUp,
    Trash2, ExternalLink,
} from 'lucide-react';
import type { AsgardEvent } from '../hooks/useSocket';

interface ActivityFeedProps {
    events: AsgardEvent[];
    connected: boolean;
    clearEvents: () => void;
}

// ─── Event Display Config ────────────────────────────────────────────────────

interface EventConfig {
    icon: React.ReactNode;
    label: string;
    color: string;
    pillClass: string;
}

const EVENT_CONFIG: Record<string, EventConfig> = {
    'agent:provisioned': { icon: <Bot size={13} />, label: 'Agent Provisioned', color: 'var(--green)', pillClass: 'green' },
    'agent:listed': { icon: <Bot size={13} />, label: 'Agents Listed', color: 'var(--blue)', pillClass: 'blue' },
    'agent:queried': { icon: <Bot size={13} />, label: 'Agent Queried', color: 'var(--blue)', pillClass: 'blue' },
    'intent:swap:pending': { icon: <ArrowRightLeft size={13} />, label: 'Swap Pending', color: 'var(--yellow)', pillClass: 'yellow' },
    'intent:swap:success': { icon: <ArrowRightLeft size={13} />, label: 'Swap Confirmed', color: 'var(--green)', pillClass: 'green' },
    'intent:swap:failed': { icon: <ArrowRightLeft size={13} />, label: 'Swap Failed', color: 'var(--red)', pillClass: 'red' },
    'intent:transfer:pending': { icon: <Send size={13} />, label: 'Transfer Pending', color: 'var(--yellow)', pillClass: 'yellow' },
    'intent:transfer:success': { icon: <Send size={13} />, label: 'Transfer Confirmed', color: 'var(--green)', pillClass: 'green' },
    'intent:transfer:failed': { icon: <Send size={13} />, label: 'Transfer Failed', color: 'var(--red)', pillClass: 'red' },
    'wallet:balance:queried': { icon: <Wallet size={13} />, label: 'Balance Check', color: 'var(--blue)', pillClass: 'blue' },
    'wallet:history:queried': { icon: <Clock size={13} />, label: 'History Check', color: 'var(--blue)', pillClass: 'blue' },
    'policy:violation': { icon: <ShieldAlert size={13} />, label: 'Policy Violation', color: 'var(--red)', pillClass: 'red' },
    'gateway:started': { icon: <Radio size={13} />, label: 'Gateway Started', color: 'var(--green)', pillClass: 'green' },
    'gateway:connected': { icon: <Radio size={13} />, label: 'Connected', color: 'var(--green)', pillClass: 'green' },
};

function getConfig(type: string): EventConfig {
    return EVENT_CONFIG[type] || {
        icon: <Activity size={13} />,
        label: type,
        color: 'var(--muted)',
        pillClass: 'blue',
    };
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function summarize(event: AsgardEvent): string {
    const p = event.payload;
    switch (event.type) {
        case 'agent:provisioned':
            return `${p.name} provisioned → ${shortAddr(p.walletAddress as string)}`;
        case 'agent:listed':
            return `${p.count} agent(s) listed`;
        case 'agent:queried':
            return `Queried agent ${p.name}`;
        case 'intent:swap:pending':
            return `${p.agentName}: Swapping ${p.amount} ${p.inputToken} → ${p.outputToken}`;
        case 'intent:swap:success':
            return `${p.agentName}: Swapped ${p.inputAmount} ${p.inputToken} → ${p.outputToken}`;
        case 'intent:swap:failed':
            return `${p.agentName}: Swap failed — ${p.error}`;
        case 'intent:transfer:pending':
            return `${p.agentName}: Transferring ${p.amount} ${p.token} → ${shortAddr(p.destination as string)}`;
        case 'intent:transfer:success':
            return `${p.agentName}: Sent ${p.amount} ${p.token} → ${shortAddr(p.destination as string)}`;
        case 'intent:transfer:failed':
            return `${p.agentName}: Transfer failed — ${p.error}`;
        case 'wallet:balance:queried':
            return `Balance queried for ${shortAddr(p.address as string)}`;
        case 'wallet:history:queried':
            return `History queried (${p.transactionCount} txns)`;
        case 'policy:violation':
            return `${p.agentName}: ${p.action} blocked by policy`;
        case 'gateway:started':
            return `Daemon started on port ${p.port}`;
        case 'gateway:connected':
            return 'Dashboard connected to event stream';
        default:
            return JSON.stringify(p);
    }
}

function shortAddr(addr: string): string {
    if (!addr || addr.length < 10) return addr || '—';
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ActivityFeed({ events, connected, clearEvents }: ActivityFeedProps) {
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="card-title">Live Activity Feed</span>
                    <span
                        className={`pill ${connected ? 'green' : 'red'}`}
                        style={{ fontSize: 10, padding: '1px 8px' }}
                    >
                        <Radio size={8} style={{ marginRight: 3 }} />
                        {connected ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {events.length > 0 && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={clearEvents}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                        >
                            <Trash2 size={11} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {events.length === 0 ? (
                <div className="empty">
                    <div className="empty-icon">
                        <Activity size={36} strokeWidth={1} style={{ opacity: 0.3, margin: '0 auto' }} />
                    </div>
                    Waiting for agent activity…
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                        Events from swaps, transfers, and provisions will appear here in real time.
                    </div>
                </div>
            ) : (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {events.map((event, i) => {
                        const config = getConfig(event.type);
                        const key = `${event.timestamp}-${event.type}-${i}`;
                        const isExpanded = expanded === key;
                        const explorerUrl = event.payload.explorerUrl as string | undefined;

                        return (
                            <div
                                key={key}
                                style={{
                                    padding: '10px 16px',
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s',
                                }}
                                onClick={() => setExpanded(isExpanded ? null : key)}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-hover, rgba(255,255,255,0.02))')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ color: config.color, flexShrink: 0 }}>
                                        {config.icon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                            <span className={`pill ${config.pillClass}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                                                {config.label}
                                            </span>
                                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                {formatTime(event.timestamp)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 12.5, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {summarize(event)}
                                        </div>
                                    </div>
                                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {explorerUrl && (
                                            <a
                                                href={explorerUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ color: 'var(--blue)', display: 'flex' }}
                                                title="View on Solana Explorer"
                                            >
                                                <ExternalLink size={12} />
                                            </a>
                                        )}
                                        {isExpanded ? <ChevronUp size={12} style={{ opacity: 0.4 }} /> : <ChevronDown size={12} style={{ opacity: 0.4 }} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <pre style={{
                                        marginTop: 8,
                                        padding: 10,
                                        borderRadius: 6,
                                        background: 'var(--bg)',
                                        fontSize: 11,
                                        lineHeight: 1.5,
                                        overflow: 'auto',
                                        maxHeight: 200,
                                        color: 'var(--muted)',
                                    }}>
                                        {JSON.stringify(event.payload, null, 2)}
                                    </pre>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
