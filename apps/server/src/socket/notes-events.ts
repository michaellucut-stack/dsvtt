import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import type { NoteItem } from '../api/notes/notes.service.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// ---------------------------------------------------------------------------
// Broadcast helpers (called from REST routes)
// ---------------------------------------------------------------------------

/**
 * Broadcast NOTE_CREATED to all members of a room when a note is created
 * via the REST API.
 */
export function broadcastNoteCreated(
  io: TypedServer,
  roomId: string,
  sessionId: string,
  note: NoteItem,
): void {
  io.to(roomId).emit('NOTE_CREATED', {
    sessionId,
    note: {
      id: note.id,
      title: note.title,
      content: note.content,
      updatedBy: note.updatedBy,
      updatedAt: note.updatedAt,
    },
  });
}

/**
 * Broadcast NOTE_UPDATED to all members of a room for real-time
 * collaborative editing.
 */
export function broadcastNoteUpdated(
  io: TypedServer,
  roomId: string,
  sessionId: string,
  note: NoteItem,
): void {
  io.to(roomId).emit('NOTE_UPDATED', {
    sessionId,
    note: {
      id: note.id,
      title: note.title,
      content: note.content,
      updatedBy: note.updatedBy,
      updatedAt: note.updatedAt,
    },
  });
}

/**
 * Broadcast NOTE_DELETED to all members of a room when a note is deleted.
 */
export function broadcastNoteDeleted(
  io: TypedServer,
  roomId: string,
  sessionId: string,
  noteId: string,
): void {
  io.to(roomId).emit('NOTE_DELETED', { sessionId, noteId });
}
