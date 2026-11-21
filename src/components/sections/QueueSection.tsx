import { useState } from 'react';
import { ArrowDown, ArrowUp, Play, Plus, Shuffle, Trash2 } from 'lucide-react';
import type { GuildPlayerState, HistoryEntry, TrackItem } from '../../shared/types.ts';
import { formatMs, formatRelativeTime } from '../../utils/format.ts';
import { ResilientImage } from '../ResilientImage.tsx';

interface QueueSectionProps {
  player: GuildPlayerState;
  history: HistoryEntry[];
  catalog: TrackItem[];
  onPlayerAction: (action: string, value?: unknown) => Promise<void>;
  onAddTrack: (track: TrackItem, playNow: boolean) => Promise<void>;
  onRemoveQueueItem: (index: number) => Promise<void>;
  onMoveQueueItem: (from: number, to: number) => Promise<void>;
}

export function QueueSection({
  player,
  history,
  catalog,
  onPlayerAction,
  onAddTrack,
  onRemoveQueueItem,
  onMoveQueueItem,
}: QueueSectionProps) {
  const [tab, setTab] = useState<'queue' | 'history'>('queue');
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    const base = catalog[Math.floor(Math.random() * catalog.length)];
    await onAddTrack(
      {
        ...base,
        id: `custom_${Date.now()}`,
        title: customTitle.trim(),
        artist: customArtist.trim() || 'Requested Track',
        addedAt: Date.now(),
      },
      false
    );
    setCustomTitle('');
    setCustomArtist('');
  };

  return (
    <div className="space-y-6">
      {/* Add Track Bar */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Queue Management</h2>
            <p className="text-xs text-zinc-500">
              {player.guildName} · {player.queue.length} upcoming tracks
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={player.queue.length < 2}
              onClick={() => void onPlayerAction('shuffle')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 border border-zinc-700 rounded-md hover:bg-zinc-900 disabled:opacity-40 transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>
            <button
              type="button"
              disabled={player.queue.length === 0}
              onClick={() => void onPlayerAction('clear')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-300 border border-red-900/60 rounded-md hover:bg-red-950/40 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Queue</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleAddCustom} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Track title or query to enqueue…"
            className="sm:col-span-6 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          />
          <input
            type="text"
            value={customArtist}
            onChange={(e) => setCustomArtist(e.target.value)}
            placeholder="Artist (optional)"
            className="sm:col-span-4 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          />
          <button
            type="submit"
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enqueue</span>
          </button>
        </form>
      </section>

      {/* Tabs: Upcoming Queue vs Music History */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-md">
            <button
              type="button"
              onClick={() => setTab('queue')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                tab === 'queue' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Upcoming ({player.queue.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                tab === 'history' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Music History ({history.length})
            </button>
          </div>
        </div>

        {tab === 'queue' ? (
          player.queue.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="text-sm text-zinc-400">The upcoming queue is empty.</div>
              <div className="flex flex-wrap justify-center gap-2">
                {catalog.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void onAddTrack(t, false)}
                    className="px-3 py-1.5 text-xs border border-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-900"
                  >
                    + {t.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {player.queue.map((track, idx) => (
                <div
                  key={`${track.id}_${idx}`}
                  className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-xs font-mono text-zinc-500 tabular-nums shrink-0">
                      {idx + 1}.
                    </span>
                    <ResilientImage
                      src={track.artworkUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded object-cover border border-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">{track.title}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        {track.artist} · Requested by {track.requestedBy.username}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-mono text-zinc-400 tabular-nums mr-2 hidden sm:inline">
                      {formatMs(track.durationMs)}
                    </span>
                    <button
                      type="button"
                      title="Play this track now"
                      onClick={() => void onPlayerAction('jump', idx)}
                      className="p-1.5 rounded border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      type="button"
                      title="Move up"
                      disabled={idx === 0}
                      onClick={() => void onMoveQueueItem(idx, idx - 1)}
                      className="p-1.5 rounded border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={idx === player.queue.length - 1}
                      onClick={() => void onMoveQueueItem(idx, idx + 1)}
                      className="p-1.5 rounded border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remove from queue"
                      onClick={() => void onRemoveQueueItem(idx)}
                      className="p-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-red-300 hover:bg-zinc-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : history.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            No tracks recorded in SQLite history for this server yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-zinc-900/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ResilientImage
                    src={entry.track.artworkUrl}
                    alt={entry.track.title}
                    className="w-10 h-10 rounded object-cover border border-zinc-800 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100 truncate">{entry.track.title}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      {entry.track.artist} · Played {formatRelativeTime(entry.playedAt)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onAddTrack(entry.track, true)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-200 border border-zinc-700 rounded hover:bg-zinc-800 shrink-0"
                >
                  Replay
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
