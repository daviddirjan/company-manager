import { dbRun, dbGet, dbAll, lastInsertRowId } from '../database';

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export function createChatSession(title: string): number {
  dbRun(`INSERT INTO chat_sessions (title) VALUES (?)`, [title]);
  return lastInsertRowId();
}

export function listChatSessions(): ChatSession[] {
  return dbAll<ChatSession>(`SELECT * FROM chat_sessions ORDER BY updated_at DESC`);
}

export function deleteChatSession(id: number): void {
  dbRun(`DELETE FROM chat_sessions WHERE id = ?`, [id]);
}

export function getChatMessages(sessionId: number): ChatMessage[] {
  return dbAll<ChatMessage>(`SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id ASC`, [sessionId]);
}

export function saveChatMessage(sessionId: number, role: 'user' | 'assistant', content: string): void {
  dbRun(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)`, [sessionId, role, content]);
  dbRun(`UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`, [sessionId]);
}

export function renameChatSession(id: number, title: string): void {
  dbRun(`UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`, [title, id]);
}

export function getChatSession(id: number): ChatSession | null {
  return dbGet<ChatSession>(`SELECT * FROM chat_sessions WHERE id = ?`, [id]);
}
