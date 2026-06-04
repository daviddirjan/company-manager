import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, AlertCircle, Bot, User, Plus, MessageSquare } from 'lucide-react';
import { api } from '../api/ipc';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  id: number;
  title: string;
  updated_at: string;
}

type Status = 'idle' | 'streaming' | 'error';

function fmtDate(iso: string) {
  const d = new Date(iso.includes('T') ? iso : iso + 'Z');
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export function Chat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [hoveredSession, setHoveredSession] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef(false);
  const activeIdRef = useRef<number | null>(null);

  // Keep ref in sync so stream handler can use latest value
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useEffect(() => {
    loadSessions();

    const handleStream = ({ chunk, done }: { chunk: string; done: boolean }) => {
      if (done) {
        streamingRef.current = false;
        setStatus('idle');
        loadSessions();
        return;
      }
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') {
          return [...prev, { role: 'assistant', content: chunk }];
        }
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      });
    };

    const handleStatus = ({ ok, error }: { ok: boolean; error?: string }) => {
      if (!ok) {
        streamingRef.current = false;
        setStatus('error');
        setErrorMsg(error ?? 'Unknown error');
      }
    };

    api.chat.onStream(handleStream);
    api.chat.onStatus(handleStatus);

    return () => {
      api.chat.offStream(handleStream);
      api.chat.offStatus(handleStatus);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadSessions() {
    const list = await api.chat.sessions.list();
    setSessions(list);
  }

  async function openSession(id: number) {
    const msgs = await api.chat.messages.get(id);
    setMessages(msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
    setActiveId(id);
    setStatus('idle');
    setErrorMsg('');
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setStatus('idle');
    setErrorMsg('');
    setInput('');
  }

  async function deleteSession(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await api.chat.sessions.delete(id);
    await loadSessions();
    if (activeId === id) newChat();
  }

  async function send() {
    const text = input.trim();
    if (!text || streamingRef.current) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setStatus('streaming');
    setErrorMsg('');
    streamingRef.current = true;

    try {
      const sid = await api.chat.send(
        activeIdRef.current,
        newMessages.map(m => ({ role: m.role, content: m.content }))
      );
      // Update active session if it was just created
      if (!activeIdRef.current) {
        setActiveId(sid);
        activeIdRef.current = sid;
      }
    } catch (err) {
      streamingRef.current = false;
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const isStreaming = status === 'streaming';

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sessions sidebar */}
      <aside style={{
        width: 220, background: '#f1f5f9', borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 10px', borderBottom: '1px solid #e2e8f0' }}>
          <button
            onClick={newChat}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
              background: '#fff', color: '#1e293b', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
          {sessions.length === 0 && (
            <p style={{ fontSize: 12, color: '#94a3b8', padding: '12px 8px', textAlign: 'center' }}>
              No saved chats yet
            </p>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => openSession(s.id)}
              onMouseEnter={() => setHoveredSession(s.id)}
              onMouseLeave={() => setHoveredSession(null)}
              style={{
                padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                background: activeId === s.id ? '#dbeafe' : hoveredSession === s.id ? '#e2e8f0' : 'transparent',
                display: 'flex', alignItems: 'flex-start', gap: 6, position: 'relative',
              }}
            >
              <MessageSquare size={13} style={{ flexShrink: 0, marginTop: 2, color: activeId === s.id ? '#3b82f6' : '#94a3b8' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12, fontWeight: activeId === s.id ? 600 : 400,
                  color: activeId === s.id ? '#1e40af' : '#374151',
                  margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s.title}</p>
                <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{fmtDate(s.updated_at)}</p>
              </div>
              {hoveredSession === s.id && (
                <button
                  onClick={e => deleteSession(e, s.id)}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                    color: '#ef4444', display: 'flex', alignItems: 'center',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              {activeId ? (sessions.find(s => s.id === activeId)?.title ?? 'Chat') : 'New Chat'}
            </h1>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              Ask questions about your invoices and clients
            </p>
          </div>
          {isStreaming && (
            <span style={{ fontSize: 12, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6', animation: 'chatPulse 1s infinite' }} />
              Generating…
            </span>
          )}
        </div>

        {/* Error banner */}
        {status === 'error' && (
          <div style={{
            margin: '12px 20px 0', padding: '10px 14px',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#dc2626',
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 10 }}>
              <Bot size={36} style={{ opacity: 0.35 }} />
              <p style={{ fontSize: 13, textAlign: 'center', margin: 0 }}>Ask me anything about your invoices, clients, or payments.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 4 }}>
                {['What is my total outstanding amount?', 'Which client has the most invoices?', 'How much did I invoice in EUR?'].map(hint => (
                  <button key={hint} onClick={() => { setInput(hint); textareaRef.current?.focus(); }}
                    style={{ padding: '5px 11px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 20, background: '#fff', cursor: 'pointer', color: '#475569' }}>
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? '#3b82f6' : '#8b5cf6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'user' ? <User size={13} color="#fff" /> : <Bot size={13} color="#fff" />}
              </div>
              <div style={{
                flex: 1, background: msg.role === 'user' ? '#eff6ff' : '#fff',
                border: `1px solid ${msg.role === 'user' ? '#bfdbfe' : '#e2e8f0'}`,
                borderRadius: 10, padding: '9px 13px', fontSize: 13, color: '#1e293b',
                lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content}
                {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
                  <span style={{ display: 'inline-block', width: 2, height: 13, background: '#8b5cf6', marginLeft: 2, verticalAlign: 'middle', animation: 'chatBlink 0.8s step-end infinite' }} />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 20px 16px', background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data… (Enter to send, Shift+Enter for newline)"
              disabled={isStreaming}
              rows={1}
              style={{
                flex: 1, resize: 'none', padding: '9px 13px', fontSize: 13,
                border: '1px solid #e2e8f0', borderRadius: 9, outline: 'none',
                color: '#1e293b', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                background: isStreaming ? '#f8fafc' : '#fff',
              }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={send}
              disabled={isStreaming || !input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 9, border: 'none',
                background: isStreaming || !input.trim() ? '#e2e8f0' : '#8b5cf6',
                color: isStreaming || !input.trim() ? '#94a3b8' : '#fff',
                cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes chatPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes chatBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
