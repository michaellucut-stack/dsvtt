'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRoomStore } from '@/stores/room-store';
import { MAX_PLAYERS, MIN_PLAYERS, MAX_ROOM_NAME_LENGTH } from '@dsvtt/shared';

interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateRoomModal({ open, onClose }: CreateRoomModalProps) {
  const router = useRouter();
  const createRoom = useRoomStore((s) => s.createRoom);

  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setName('');
    setMaxPlayers(4);
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Room name is required');
      return;
    }
    if (trimmedName.length > MAX_ROOM_NAME_LENGTH) {
      setError(`Room name must be at most ${MAX_ROOM_NAME_LENGTH} characters`);
      return;
    }
    if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) {
      setError(`Players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
      return;
    }

    setLoading(true);
    try {
      const room = await createRoom({ name: trimmedName, maxPlayers });
      resetForm();
      onClose();
      router.push(`/lobby/rooms/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create New Room">
      {error && (
        <div className="mb-4 rounded-card border border-crimson-700/50 bg-crimson-950/30 px-4 py-3 text-sm text-crimson-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Room Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Dragon's Lair"
          required
          maxLength={MAX_ROOM_NAME_LENGTH}
          autoFocus
        />

        <Input
          label={`Max Players (${MIN_PLAYERS}–${MAX_PLAYERS})`}
          type="number"
          value={String(maxPlayers)}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          required
        />

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="flex-1">
            {loading ? 'Creating...' : 'Create Room'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
