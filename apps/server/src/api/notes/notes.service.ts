import type { SharedNote } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { CreateNoteBody, UpdateNoteBody } from './notes.schemas.js';

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/** Serialised shared note item. */
export interface NoteItem {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  updatedBy: string | null;
  updatedAt: string;
}

function serializeNote(note: SharedNote): NoteItem {
  return {
    id: note.id,
    sessionId: note.sessionId,
    title: note.title,
    content: note.content,
    updatedBy: note.updatedBy,
    updatedAt: note.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify that a session exists and return the director ID.
 *
 * @throws {AppError} 404 if session not found.
 */
async function getSessionDirectorId(sessionId: string): Promise<string> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { room: { select: { directorId: true } } },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  return session.room.directorId;
}

/**
 * Require the requesting user to be the director for a note's session.
 *
 * @throws {AppError} 404 if note not found, 403 if not director.
 */
async function requireNoteDirector(noteId: string, userId: string): Promise<SharedNote> {
  const note = await prisma.sharedNote.findUnique({
    where: { id: noteId },
    include: { session: { include: { room: { select: { directorId: true } } } } },
  });

  if (!note) {
    throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
  }

  if (note.session.room.directorId !== userId) {
    throw new AppError(
      'Only the session director can perform this action',
      403,
      'NOTE_NOT_DIRECTOR',
    );
  }

  return note;
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Create a shared note within a game session.
 *
 * @param sessionId - The game session ID.
 * @param userId - The creating user's ID.
 * @param data - Note creation data.
 * @returns The created note.
 * @throws {AppError} 404 if session not found.
 */
export async function createNote(
  sessionId: string,
  userId: string,
  data: CreateNoteBody,
): Promise<NoteItem> {
  // Verify session exists
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  const note = await prisma.sharedNote.create({
    data: {
      sessionId,
      title: data.title,
      content: data.content,
      updatedBy: userId,
    },
  });

  return serializeNote(note);
}

/**
 * List all shared notes for a session.
 *
 * @param sessionId - The game session ID.
 * @returns Array of note items, ordered by most recently updated.
 */
export async function listNotes(sessionId: string): Promise<NoteItem[]> {
  const notes = await prisma.sharedNote.findMany({
    where: { sessionId },
    orderBy: { updatedAt: 'desc' },
  });

  return notes.map(serializeNote);
}

/**
 * Get a single note by ID.
 *
 * @param noteId - The note ID.
 * @returns The note item.
 * @throws {AppError} 404 if not found.
 */
export async function getNote(noteId: string): Promise<NoteItem> {
  const note = await prisma.sharedNote.findUnique({ where: { id: noteId } });

  if (!note) {
    throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
  }

  return serializeNote(note);
}

/**
 * Update a shared note's title and/or content. Records the updater's user ID.
 *
 * Any session member can edit a note, but the `updatedBy` field tracks who
 * last modified it.
 *
 * @param noteId - The note ID.
 * @param userId - The authenticated user's ID.
 * @param data - Partial update data.
 * @returns The updated note.
 * @throws {AppError} 404 if not found.
 */
export async function updateNote(
  noteId: string,
  userId: string,
  data: UpdateNoteBody,
): Promise<NoteItem> {
  const existing = await prisma.sharedNote.findUnique({ where: { id: noteId } });

  if (!existing) {
    throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
  }

  const note = await prisma.sharedNote.update({
    where: { id: noteId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      updatedBy: userId,
    },
  });

  return serializeNote(note);
}

/**
 * Delete a shared note. Director only.
 *
 * @param noteId - The note ID.
 * @param userId - The authenticated user's ID (must be director).
 * @throws {AppError} 404 if not found, 403 if not director.
 */
export async function deleteNote(
  noteId: string,
  userId: string,
): Promise<void> {
  await requireNoteDirector(noteId, userId);
  await prisma.sharedNote.delete({ where: { id: noteId } });
}

/**
 * Look up the roomId for a given session.
 *
 * @param sessionId - The game session ID.
 * @returns The room ID, or null if not found.
 */
export async function getRoomIdForSession(sessionId: string): Promise<string | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { roomId: true },
  });
  return session?.roomId ?? null;
}
