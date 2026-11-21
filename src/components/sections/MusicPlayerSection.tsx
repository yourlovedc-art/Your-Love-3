import { useRef, useState } from 'react';
import {
  Heart,
  ListOrdered,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Upload,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { FavoriteEntry, GuildPlayerState, LoopMode, TrackItem } from '../../shared/types.ts';
import { buildAsciiProgress, formatMs } from '../../utils/format.ts';
import { ResilientImage } from '../ResilientImage.tsx';
import type { DashboardSection } from '../Sidebar.tsx';

interface MusicPlayerSectionProps {
  player: GuildPlayerState;
  favorites: FavoriteEntry[];
  samuraiLogoUrl: string;
  onPlayerAction: (action: string, value?: unknown) => Promise<void>;
  onToggleFavorite: (track: TrackItem) => Promise<void>;
  onUploadAudio: (file: File) => Promise<void>;
  onNavigate: (section: DashboardSection) => void;
}

export function MusicPlayerSection({
  player,
  favorites,
  samuraiLogoUrl,
  onPlayerAction,
  onToggleFavorite,
  onUploadAudio,
  onNavigate,
}: MusicPlayerSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [queuePreviewOpen, setQueuePreviewOpen] = useState(false);

  const track = player.currentTrack;
  const isPlaying = Boolean(track && player.playing && !player.paused);
  const isFavorited = Boolean(track && favorites.some((f) => f.track.id === track.id));

  const loopLabel = (mode: LoopMode) =>
    mode === 'off' ? 'Off' : mode === 'song' ? 'Song' : 'Queue';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await onUploadAudio(file);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload audio file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Classic Monochrome Samurai Music Player */}
      <section className="lg:col-span-7 border border-zinc-800/80 rounded-lg bg-[#121215] p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-100 tracking-wide">
              Classic Studio Console
            </h2>
            <p className="text-xs text-zinc-400">
              {player.guildName} · {player.voiceChannelName} · {isPlaying ? 'Playing' : player.paused ? 'Paused' : 'Idle'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.m4a,.flac,.webm,audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 border border-zinc-700 rounded-md hover:bg-zinc-900 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading…' : 'Upload Audio'}</span>
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="px-4 py-2.5 text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-md">
            {uploadError}
          </div>
        )}

        {/* Artwork & Track Details */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-44 h-44 sm:w-48 sm:h-48 rounded-lg overflow-hidden border border-zinc-700 bg-black shrink-0">
            <ResilientImage
              src={track?.artworkUrl || samuraiLogoUrl}
              alt={track?.title || 'Shadow Music'}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 w-full space-y-3 text-center sm:text-left">
            <div className="text-xs text-zinc-500">
              {track ? `Source: ${track.source.toUpperCase()} · Requested by ${track.requestedBy.username}` : 'No Track Active'}
            </div>
            <h3 className="text-2xl font-semibold text-zinc-100 truncate">
              {track ? track.title : 'Queue Empty'}
            </h3>
            <p className="text-sm text-zinc-400 truncate">
              {track ? track.artist : 'Select an instrumental from Home or upload an audio file.'}
            </p>

            {/* Metadata strip without pills */}
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-zinc-400 font-mono tabular-nums">
              <span>Queue: {player.queue.length}</span>
              <span aria-hidden="true">·</span>
              <span>Loop: {loopLabel(player.loop)}</span>
              <span aria-hidden="true">·</span>
              <span>Shuffle: {player.shuffle ? 'On' : 'Off'}</span>
              <span aria-hidden="true">·</span>
              <span>Autoplay: {player.autoplay ? 'On' : 'Off'}</span>
            </div>

            {track && (
              <div className="pt-2 flex items-center justify-center sm:justify-start gap-3">
                <button
                  type="button"
                  onClick={() => void onToggleFavorite(track)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    isFavorited
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                      : 'text-zinc-300 border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current' : ''}`} />
                  <span>{isFavorited ? 'Saved to Favorites' : 'Favorite'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void onPlayerAction('autoplay')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    player.autoplay
                      ? 'bg-zinc-800 text-zinc-100 border-zinc-600'
                      : 'text-zinc-400 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  <span>Autoplay: {player.autoplay ? 'On' : 'Off'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Scrubber */}
        <div className="space-y-2">
          <input
            type="range"
            aria-label="Seek track position"
            min={0}
            max={track?.durationMs || 100}
            value={Math.min(player.positionMs, track?.durationMs || 100)}
            disabled={!track}
            onChange={(e) => void onPlayerAction('seek', Number(e.target.value))}
            className="w-full samurai-range disabled:opacity-40"
          />
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 tabular-nums">
            <span>{formatMs(player.positionMs)}</span>
            <span>{formatMs(track?.durationMs || 0)}</span>
          </div>
        </div>

        {/* Classic Transport Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Toggle Shuffle"
              onClick={() => void onPlayerAction('shuffle')}
              className={`p-2.5 rounded-md border transition-colors ${
                player.shuffle
                  ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                  : 'text-zinc-400 border-zinc-800 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Previous Track"
              disabled={player.previousTracks.length === 0}
              onClick={() => void onPlayerAction('previous')}
              className="p-2.5 rounded-md border border-zinc-800 text-zinc-200 hover:bg-zinc-900 disabled:opacity-40 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              title={isPlaying ? 'Pause' : 'Play'}
              onClick={() => void onPlayerAction(track ? 'togglePause' : 'play')}
              className="px-6 py-2.5 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white font-semibold inline-flex items-center gap-2 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span className="text-xs">{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              title="Skip Track"
              disabled={!track}
              onClick={() => void onPlayerAction('skip')}
              className="p-2.5 rounded-md border border-zinc-800 text-zinc-200 hover:bg-zinc-900 disabled:opacity-40 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Stop & Clear"
              disabled={!track && player.queue.length === 0}
              onClick={() => void onPlayerAction('stop')}
              className="p-2.5 rounded-md border border-zinc-800 text-zinc-300 hover:bg-zinc-900 disabled:opacity-40 transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>

            <button
              type="button"
              title={`Loop Mode (${loopLabel(player.loop)})`}
              onClick={() => void onPlayerAction('loop')}
              className={`p-2.5 rounded-md border transition-colors ${
                player.loop !== 'off'
                  ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                  : 'text-zinc-400 border-zinc-800 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              {player.loop === 'song' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-3 min-w-[180px]">
            <button
              type="button"
              title="Mute / Restore"
              onClick={() => void onPlayerAction('volume', player.volume <= 5 ? 75 : 1)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              {player.volume <= 1 ? (
                <VolumeX className="w-4 h-4" />
              ) : player.volume < 50 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              aria-label="Volume level"
              min={1}
              max={100}
              value={player.volume}
              onChange={(e) => void onPlayerAction('volume', Number(e.target.value))}
              className="w-28 samurai-range"
            />
            <span className="text-xs font-mono text-zinc-300 tabular-nums w-9 text-right">
              {player.volume}%
            </span>
          </div>
        </div>
      </section>

      {/* Right: Live Synced Discord Embed & Interactive Button Controller */}
      <section className="lg:col-span-5 border border-zinc-800/80 rounded-lg bg-[#121215] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Discord Player Embed</h2>
            <p className="text-xs text-zinc-500">
              Live interactive embed synced to {player.textChannelName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('queue')}
            className="text-xs text-zinc-400 hover:text-zinc-100 underline-offset-4 hover:underline"
          >
            Manage Queue
          </button>
        </div>

        {/* Authentic Discord Dark Embed Card */}
        <div className="rounded-md bg-[#1E1F22] border border-zinc-800 p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <ResilientImage
              src={samuraiLogoUrl}
              alt="Shadow Music Avatar"
              className="w-5 h-5 rounded-full object-cover"
            />
            <span>SHADOW MUSIC · Where Silence Meets Sound.</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2 flex-1">
              <div className="text-sm font-semibold text-white truncate">
                {track ? track.title : 'No Track Currently Playing'}
              </div>
              <div className="text-xs text-zinc-300 truncate">
                {track ? track.artist : 'Use /play [song] in Discord'}
              </div>

              <div className="pt-1 font-mono text-[11px] text-zinc-300 tabular-nums whitespace-nowrap overflow-hidden">
                <span>{formatMs(player.positionMs)}</span>{' '}
                <span className="text-zinc-400">
                  {buildAsciiProgress(player.positionMs, track?.durationMs || 0, 14)}
                </span>{' '}
                <span>{formatMs(track?.durationMs || 0)}</span>
              </div>
            </div>

            <ResilientImage
              src={track?.artworkUrl || samuraiLogoUrl}
              alt="Embed thumbnail"
              className="w-16 h-16 rounded object-cover border border-zinc-700 shrink-0"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
            <div>
              <div className="text-[11px] font-semibold text-zinc-400">Requested By</div>
              <div className="text-zinc-200 truncate">{track ? track.requestedBy.username : '—'}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-400">Queue Position</div>
              <div className="text-zinc-200 font-mono tabular-nums">{player.queue.length} upcoming</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-400">Volume</div>
              <div className="text-zinc-200 font-mono tabular-nums">{player.volume}%</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-400">Loop</div>
              <div className="text-zinc-200">{loopLabel(player.loop)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-400">Shuffle</div>
              <div className="text-zinc-200">{player.shuffle ? 'Enabled' : 'Off'}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-400">Status</div>
              <div className="text-zinc-200">{isPlaying ? 'Playing' : player.paused ? 'Paused' : 'Idle'}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-700/60 text-[11px] text-zinc-400">
            Shadow Music · {player.guildName}
          </div>
        </div>

        {/* All 9 Required Interactive Discord Player Buttons */}
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1.5">
            <button
              type="button"
              disabled={player.previousTracks.length === 0}
              onClick={() => void onPlayerAction('previous')}
              className="px-2 py-2 text-[11px] font-medium rounded bg-[#2B2D31] hover:bg-[#35373C] text-zinc-100 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => void onPlayerAction(track ? 'togglePause' : 'play')}
              className="px-2 py-2 text-[11px] font-semibold rounded bg-zinc-100 hover:bg-white text-zinc-950 transition-colors whitespace-nowrap"
            >
              {isPlaying ? 'Pause' : 'Resume'}
            </button>
            <button
              type="button"
              disabled={!track}
              onClick={() => void onPlayerAction('skip')}
              className="px-2 py-2 text-[11px] font-medium rounded bg-[#2B2D31] hover:bg-[#35373C] text-zinc-100 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              Skip
            </button>
            <button
              type="button"
              disabled={!track && player.queue.length === 0}
              onClick={() => void onPlayerAction('stop')}
              className="px-2 py-2 text-[11px] font-medium rounded bg-red-900/70 hover:bg-red-800/80 text-zinc-100 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              Stop
            </button>
            <button
              type="button"
              onClick={() => void onPlayerAction('loop')}
              className={`px-2 py-2 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                player.loop !== 'off'
                  ? 'bg-zinc-200 text-zinc-950'
                  : 'bg-[#2B2D31] hover:bg-[#35373C] text-zinc-100'
              }`}
            >
              Loop: {loopLabel(player.loop)}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => void onPlayerAction('shuffle')}
              className={`px-2 py-2 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                player.shuffle
                  ? 'bg-zinc-200 text-zinc-950'
                  : 'bg-[#2B2D31] hover:bg-[#35373C] text-zinc-100'
              }`}
            >
              Shuffle
            </button>
            <button
              type="button"
              onClick={() => setQueuePreviewOpen((v) => !v)}
              className="px-2 py-2 text-[11px] font-medium rounded bg-[#2B2D31] hover:bg-[#35373C] text-zinc-100 inline-flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <ListOrdered className="w-3 h-3" />
              <span>Queue ({player.queue.length})</span>
            </button>
            <button
              type="button"
              disabled={player.volume <= 1}
              onClick={() => void onPlayerAction('volume', Math.max(1, player.volume - 10))}
              className="px-2 py-2 text-[11px] font-medium rounded bg-[#2B2D31] hover:bg-[#35373C] text-zinc-100 disabled:opacity-40 whitespace-nowrap"
            >
              Vol -
            </button>
            <button
              type="button"
              disabled={player.volume >= 100}
              onClick={() => void onPlayerAction('volume', Math.min(100, player.volume + 10))}
              className="px-2 py-2 text-[11px] font-medium rounded bg-[#2B2D31] hover:bg-[#35373C] text-zinc-100 disabled:opacity-40 whitespace-nowrap"
            >
              Vol +
            </button>
          </div>

          {/* Discord Select Menu: Jump to Track in Queue */}
          <select
            aria-label="Jump to track in queue"
            value=""
            disabled={player.queue.length === 0}
            onChange={(e) => {
              if (e.target.value !== '') {
                void onPlayerAction('jump', Number(e.target.value));
              }
            }}
            className="w-full bg-[#1E1F22] border border-zinc-700 text-zinc-200 text-xs rounded px-3 py-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <option value="">
              {player.queue.length > 0
                ? 'Jump to track in queue…'
                : 'Queue is empty — add tracks to jump'}
            </option>
            {player.queue.map((q, idx) => (
              <option key={`${q.id}_${idx}`} value={idx}>
                {idx + 1}. {q.title} — {q.artist} ({formatMs(q.durationMs)})
              </option>
            ))}
          </select>

          {queuePreviewOpen && (
            <div className="mt-2 p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1.5 text-xs">
              <div className="font-semibold text-zinc-200">Upcoming Queue Snapshot</div>
              {player.queue.length === 0 ? (
                <div className="text-zinc-500">Queue is empty.</div>
              ) : (
                player.queue.slice(0, 6).map((q, i) => (
                  <div key={`${q.id}_${i}`} className="flex justify-between text-zinc-400 gap-2">
                    <span className="truncate">
                      {i + 1}. {q.title}
                    </span>
                    <span className="font-mono tabular-nums shrink-0">{formatMs(q.durationMs)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
