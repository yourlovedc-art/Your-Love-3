import { useState } from 'react';
import { Heart, ListMusic, Play, Plus, Trash2 } from 'lucide-react';
import type { FavoriteEntry, PlaylistRecord, TrackItem } from '../../shared/types.ts';
import { formatMs } from '../../utils/format.ts';
import { ResilientImage } from '../ResilientImage.tsx';

interface PlaylistSectionProps {
  playlists: PlaylistRecord[];
  favorites: FavoriteEntry[];
  currentTrack: TrackItem | null;
  catalog: TrackItem[];
  onCreatePlaylist: (name: string, description: string) => Promise<void>;
  onDeletePlaylist: (name: string) => Promise<void>;
  onAddTrackToPlaylist: (playlistName: string, track: TrackItem) => Promise<void>;
  onRemoveTrackFromPlaylist: (playlistName: string, index: number) => Promise<void>;
  onPlayPlaylist: (name: string) => Promise<void>;
  onPlayTrack: (track: TrackItem, playNow: boolean) => Promise<void>;
  onToggleFavorite: (track: TrackItem) => Promise<void>;
}

export function PlaylistSection({
  playlists,
  favorites,
  currentTrack,
  catalog,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onPlayPlaylist,
  onPlayTrack,
  onToggleFavorite,
}: PlaylistSectionProps) {
  const [selectedName, setSelectedName] = useState<string>(playlists[0]?.name || '');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'playlists' | 'favorites'>('playlists');

  const activePlaylist = playlists.find((p) => p.name === selectedName) || playlists[0] || null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    try {
      await onCreatePlaylist(newName.trim(), newDesc.trim());
      setSelectedName(newName.trim());
      setNewName('');
      setNewDesc('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create playlist.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switch */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-md">
          <button
            type="button"
            onClick={() => setViewMode('playlists')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === 'playlists' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Custom Playlists ({playlists.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('favorites')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === 'favorites' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Favorite Songs ({favorites.length})
          </button>
        </div>
      </div>

      {viewMode === 'favorites' ? (
        <section className="border border-zinc-800/80 rounded-lg bg-[#121215] overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/80">
            <h2 className="text-sm font-semibold text-zinc-100">Saved Favorites</h2>
            <p className="text-xs text-zinc-500">Tracks starred from the Shadow Music player</p>
          </div>
          {favorites.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              No favorite tracks saved yet. Click Favorite in the Music Player to bookmark a track.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {favorites.map((fav) => (
                <div key={fav.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <ResilientImage
                      src={fav.track.artworkUrl}
                      alt={fav.track.title}
                      className="w-10 h-10 rounded object-cover border border-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">{fav.track.title}</div>
                      <div className="text-xs text-zinc-500 truncate">{fav.track.artist}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onPlayTrack(fav.track, true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded hover:bg-white"
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      title="Remove favorite"
                      onClick={() => void onToggleFavorite(fav.track)}
                      className="p-1.5 text-zinc-300 border border-zinc-800 rounded hover:bg-zinc-800"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Playlist List + Create Form */}
          <section className="lg:col-span-5 border border-zinc-800/80 rounded-lg bg-[#121215] p-5 space-y-5">
            <h2 className="text-sm font-semibold text-zinc-100">Create Playlist</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name (e.g. Dojo Focus)"
                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              />
              {error && <div className="text-xs text-red-400">{error}</div>}
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Playlist</span>
              </button>
            </form>

            <div className="pt-4 border-t border-zinc-800/80 space-y-2">
              <div className="text-xs font-medium text-zinc-400">Saved Server Playlists</div>
              {playlists.length === 0 ? (
                <div className="text-xs text-zinc-500 py-4">No playlists created yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {playlists.map((pl) => {
                    const selected = activePlaylist?.id === pl.id;
                    return (
                      <div
                        key={pl.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-md border transition-colors ${
                          selected
                            ? 'bg-zinc-900 border-zinc-600 text-zinc-100'
                            : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedName(pl.name)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="text-xs font-semibold truncate">{pl.name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                            {pl.tracks.length} tracks · {pl.ownerName}
                          </div>
                        </button>
                        <button
                          type="button"
                          title="Delete playlist"
                          onClick={() => void onDeletePlaylist(pl.name)}
                          className="p-1.5 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right: Active Playlist Tracks */}
          <section className="lg:col-span-7 border border-zinc-800/80 rounded-lg bg-[#121215] overflow-hidden">
            {activePlaylist ? (
              <>
                <div className="p-6 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-zinc-100">
                      {activePlaylist.name}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {activePlaylist.description || 'Custom Shadow Music playlist'} ·{' '}
                      {activePlaylist.tracks.length} tracks
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentTrack && (
                      <button
                        type="button"
                        onClick={() => void onAddTrackToPlaylist(activePlaylist.name, currentTrack)}
                        className="px-3 py-2 text-xs font-medium text-zinc-200 border border-zinc-700 rounded-md hover:bg-zinc-900"
                      >
                        + Add Current Song
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={activePlaylist.tracks.length === 0}
                      onClick={() => void onPlayPlaylist(activePlaylist.name)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white disabled:opacity-40"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play All</span>
                    </button>
                  </div>
                </div>

                {activePlaylist.tracks.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <ListMusic className="w-7 h-7 text-zinc-600 mx-auto" />
                    <div className="text-xs text-zinc-400">
                      This playlist is empty. Quick-add a Dojo instrumental below:
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {catalog.slice(0, 4).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => void onAddTrackToPlaylist(activePlaylist.name, t)}
                          className="px-3 py-1.5 text-xs border border-zinc-700 rounded hover:bg-zinc-900 text-zinc-300"
                        >
                          + {t.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/60">
                    {activePlaylist.tracks.map((t, idx) => (
                      <div
                        key={`${t.id}_${idx}`}
                        className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-zinc-900/40"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-5 text-xs font-mono text-zinc-500 tabular-nums">
                            {idx + 1}.
                          </span>
                          <ResilientImage
                            src={t.artworkUrl}
                            alt={t.title}
                            className="w-9 h-9 rounded object-cover border border-zinc-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-100 truncate">{t.title}</div>
                            <div className="text-xs text-zinc-500 truncate">{t.artist}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono text-zinc-400 tabular-nums mr-1">
                            {formatMs(t.durationMs)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void onPlayTrack(t, true)}
                            className="px-2.5 py-1 text-xs border border-zinc-700 rounded text-zinc-200 hover:bg-zinc-800"
                          >
                            Play
                          </button>
                          <button
                            type="button"
                            title="Remove from playlist"
                            onClick={() => void onRemoveTrackFromPlaylist(activePlaylist.name, idx)}
                            className="p-1.5 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-sm text-zinc-500">
                Create or select a playlist on the left to manage its tracks.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
