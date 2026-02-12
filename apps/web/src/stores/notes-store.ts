import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { getSocket, type TypedSocket } from '@/lib/socket';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SharedNote {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  createdBy: string;
  lastEditedBy: string;
  lastEditedByName: string;
  isDirectorOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateNoteInput {
  sessionId: string;
  title: string;
  content?: string;
  isDirectorOnly?: boolean;
}

interface UpdateNoteInput {
  title?: string;
  content?: string;
}

/** Payload shape for NOTE_UPDATED socket events. */
interface NoteUpdatedSocketPayload {
  noteId: string;
  sessionId: string;
  title?: string;
  content?: string;
  lastEditedBy: string;
  lastEditedByName: string;
  updatedAt: string;
}

// ─── State interface ────────────────────────────────────────────────────────

interface NotesState {
  /** All shared notes for the current session. */
  notes: SharedNote[];
  /** Currently active note being viewed/edited. */
  activeNote: SharedNote | null;
  /** Loading flag. */
  loading: boolean;
  /** Error message. */
  error: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Fetch all notes for a session. */
  fetchNotes: (sessionId: string) => Promise<void>;

  /** Create a new note. */
  createNote: (input: CreateNoteInput) => Promise<SharedNote>;

  /** Update an existing note. */
  updateNote: (noteId: string, changes: UpdateNoteInput) => Promise<void>;

  /** Delete a note. */
  deleteNote: (noteId: string) => Promise<void>;

  /** Set the active note. */
  setActiveNote: (note: SharedNote | null) => void;

  /** Clear all notes state. */
  clearNotes: () => void;

  /** Wire up Socket.IO listeners. Returns cleanup function. */
  subscribeToSocket: () => () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useNotesStore = create<NotesState>()((set, get) => ({
  notes: [],
  activeNote: null,
  loading: false,
  error: null,

  async fetchNotes(sessionId: string) {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<{ ok: boolean; data: SharedNote[] }>(
        `/api/sessions/${sessionId}/notes`,
      );
      set({ notes: res.data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch notes',
        loading: false,
      });
    }
  },

  async createNote(input: CreateNoteInput) {
    set({ error: null });
    try {
      const res = await apiClient.post<{ ok: boolean; data: SharedNote }>(
        `/api/sessions/${input.sessionId}/notes`,
        input,
      );
      const note = res.data;
      set((state) => ({
        notes: [...state.notes, note],
        activeNote: note,
      }));
      return note;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create note';
      set({ error: message });
      throw err;
    }
  },

  async updateNote(noteId: string, changes: UpdateNoteInput) {
    set({ error: null });

    // Optimistic update
    set((state) => {
      const updater = (n: SharedNote) => (n.id === noteId ? { ...n, ...changes } : n);
      return {
        notes: state.notes.map(updater),
        activeNote:
          state.activeNote?.id === noteId ? { ...state.activeNote, ...changes } : state.activeNote,
      };
    });

    try {
      const res = await apiClient.patch<{ ok: boolean; data: SharedNote }>(
        `/api/notes/${noteId}`,
        changes,
      );
      const updated = res.data;
      set((state) => ({
        notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
        activeNote: state.activeNote?.id === noteId ? updated : state.activeNote,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update note',
      });
    }
  },

  async deleteNote(noteId: string) {
    set({ error: null });
    try {
      await apiClient.delete(`/api/notes/${noteId}`);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== noteId),
        activeNote: state.activeNote?.id === noteId ? null : state.activeNote,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to delete note',
      });
    }
  },

  setActiveNote(note: SharedNote | null) {
    set({ activeNote: note });
  },

  clearNotes() {
    set({
      notes: [],
      activeNote: null,
      loading: false,
      error: null,
    });
  },

  subscribeToSocket() {
    const socket: TypedSocket = getSocket();

    // NOTE_UPDATED is not in the typed event map yet since it's a custom
    // Sprint 5 event.  We cast to listen for it via the generic socket API.
    // When the backend events package is updated, this cast can be removed.
    const untypedSocket = socket as unknown as {
      on: (event: string, handler: (payload: NoteUpdatedSocketPayload) => void) => void;
      off: (event: string, handler: (payload: NoteUpdatedSocketPayload) => void) => void;
    };

    const handleNoteUpdated = (payload: NoteUpdatedSocketPayload) => {
      const { noteId, title, content, lastEditedBy, lastEditedByName, updatedAt } = payload;

      set((state) => {
        const updater = (n: SharedNote): SharedNote =>
          n.id === noteId
            ? {
                ...n,
                ...(title !== undefined && { title }),
                ...(content !== undefined && { content }),
                lastEditedBy,
                lastEditedByName,
                updatedAt,
              }
            : n;

        return {
          notes: state.notes.map(updater),
          activeNote:
            state.activeNote?.id === noteId ? updater(state.activeNote) : state.activeNote,
        };
      });
    };

    untypedSocket.on('NOTE_UPDATED', handleNoteUpdated);

    return () => {
      untypedSocket.off('NOTE_UPDATED', handleNoteUpdated);
    };
  },
}));
