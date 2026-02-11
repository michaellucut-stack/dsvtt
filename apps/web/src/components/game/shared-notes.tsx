'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotesStore, type SharedNote } from '@/stores/notes-store';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';
import { Button } from '@/components/ui/button';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1_500;

// ─── Note List Item ─────────────────────────────────────────────────────────

function NoteListItem({
  note,
  isActive,
  onClick,
}: {
  note: SharedNote;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-card px-3 py-2 text-left transition-colors',
        isActive
          ? 'bg-gold-900/30 text-parchment-100 border border-gold-700/40'
          : 'bg-charcoal-800/40 text-parchment-300 border border-transparent hover:bg-charcoal-700/30',
      ].join(' ')}
    >
      <p className="truncate text-xs font-semibold">
        {note.title || 'Untitled'}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-parchment-500">
        {note.lastEditedByName
          ? `Edited by ${note.lastEditedByName}`
          : 'New note'}
      </p>
    </button>
  );
}

// ─── Note Editor ────────────────────────────────────────────────────────────

function NoteEditor({
  note,
  isDirector,
}: {
  note: SharedNote;
  isDirector: boolean;
}) {
  const updateNote = useNotesStore((s) => s.updateNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNoteRef = useRef(note);

  // Sync from incoming real-time updates
  useEffect(() => {
    if (lastNoteRef.current.updatedAt !== note.updatedAt) {
      setTitle(note.title);
      setContent(note.content);
      lastNoteRef.current = note;
    }
  }, [note]);

  // Also reset when switching notes entirely
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    lastNoteRef.current = note;
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const scheduleSave = useCallback(
    (changes: { title?: string; content?: string }) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        updateNote(note.id, changes);
        debounceTimerRef.current = null;
      }, DEBOUNCE_MS);
    },
    [note.id, updateNote],
  );

  const handleTitleChange = (val: string) => {
    setTitle(val);
    scheduleSave({ title: val, content });
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    scheduleSave({ title, content: val });
  };

  const editedAt = new Date(note.updatedAt);
  const timeStr = editedAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Title */}
      <div className="shrink-0 border-b border-charcoal-800 px-3 py-2">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title"
          className="w-full bg-transparent font-heading text-sm font-semibold text-parchment-100 placeholder:text-charcoal-500 focus:outline-none"
        />
      </div>

      {/* Content editor */}
      <div className="flex-1 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start writing..."
          className="h-full w-full resize-none border-none bg-transparent px-3 py-2 text-sm leading-relaxed text-parchment-200 placeholder:text-charcoal-500 focus:outline-none"
        />
      </div>

      {/* Footer with metadata */}
      <div className="flex shrink-0 items-center justify-between border-t border-charcoal-800 px-3 py-1.5">
        <span className="text-[10px] text-charcoal-500">
          {note.lastEditedByName
            ? `Last edited by ${note.lastEditedByName} at ${timeStr}`
            : `Created at ${timeStr}`}
        </span>
        {isDirector && (
          <button
            type="button"
            onClick={() => deleteNote(note.id)}
            className="text-[10px] text-crimson-500 transition-colors hover:text-crimson-400"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Shared Notes Panel ─────────────────────────────────────────────────────

interface SharedNotesProps {
  sessionId: string;
}

export function SharedNotes({ sessionId }: SharedNotesProps) {
  const notes = useNotesStore((s) => s.notes);
  const activeNote = useNotesStore((s) => s.activeNote);
  const setActiveNote = useNotesStore((s) => s.setActiveNote);
  const createNote = useNotesStore((s) => s.createNote);

  const userId = useAuthStore((s) => s.user?.id);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const isDirector = currentRoom?.directorId === userId;

  // Filter out director-only notes for non-directors
  const visibleNotes = notes.filter(
    (n) => !n.isDirectorOnly || isDirector,
  );

  const handleNewNote = async () => {
    try {
      await createNote({
        sessionId,
        title: 'Untitled Note',
        content: '',
        isDirectorOnly: false,
      });
    } catch {
      // error set in store
    }
  };

  const handleSelectNote = (note: SharedNote) => {
    setActiveNote(note);
  };

  // Keep activeNote in sync with notes list
  useEffect(() => {
    if (!activeNote) return;
    const updated = visibleNotes.find((n) => n.id === activeNote.id);
    if (updated && updated.updatedAt !== activeNote.updatedAt) {
      setActiveNote(updated);
    }
  }, [visibleNotes, activeNote, setActiveNote]);

  return (
    <div className="flex h-full flex-col">
      {/* Header + New Note button */}
      <div className="flex shrink-0 items-center justify-between border-b border-charcoal-800 px-3 py-2">
        <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-parchment-300">
          Shared Notes
        </h3>
        <button
          type="button"
          onClick={handleNewNote}
          className="flex items-center gap-1 text-[10px] font-semibold text-gold-500 hover:text-gold-400"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Note
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Note list sidebar */}
        <div className="flex w-36 shrink-0 flex-col gap-1 overflow-y-auto border-r border-charcoal-800 p-2">
          {visibleNotes.length === 0 ? (
            <p className="py-4 text-center text-[10px] text-charcoal-500">
              No notes yet
            </p>
          ) : (
            visibleNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isActive={activeNote?.id === note.id}
                onClick={() => handleSelectNote(note)}
              />
            ))
          )}
        </div>

        {/* Editor area */}
        {activeNote ? (
          <NoteEditor note={activeNote} isDirector={isDirector} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mb-2 text-charcoal-600"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p className="text-xs text-charcoal-500">
              Select a note or create a new one
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
