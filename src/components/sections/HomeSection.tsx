import { ArrowRight, Disc3, Play, Plus, ShieldCheck, Volume2 } from 'lucide-react';
import type {
  BotRuntimeStatus,
  BotStatsSnapshot,
  GuildPlayerState,
  GuildSettings,
  TrackItem,
} from '../../shared/types.ts';
import { formatMs } from '../../utils/format.ts';
import { ResilientImage } from '../ResilientImage.tsx';
import type { DashboardSection } from '../Sidebar.tsx';

interface HomeSectionProps {
  status: BotRuntimeStatus;
  player: GuildPlayerState;
  activeGuild: GuildSettings;
  stats: BotStatsSnapshot;
  catalog: TrackItem[];
  onNavigate: (section: DashboardSection) => void;
  onPlayTrack: (track: TrackItem, playNow: boolean) => Promise<void>;
  onPlayerAction: (action: string, value?: unknown) => Promise<void>;
}

export function HomeSection({
  status,
  player,
  activeGuild,
  stats,
  catalog,
  onNavigate,
  onPlayTrack,
  onPlayerAction,
}: HomeSectionProps) {
  return (
    <div className="space-y-8">
      {/* Hero Banner with Sumi-e Mountain Backdrop & Official Samurai Emblem */}
      <section className="relative overflow-hidden rounded-lg border border-zinc-800/80 bg-[#121215]">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <ResilientImage
            src="/src/assets/images/hero_dojo_backdrop_1795268379103.jpg"
            alt="Japanese sumi-e ink mountain landscape"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0B] via-[#0A0A0B]/85 to-transparent" />
        </div>

        <div className="relative z-10 p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <p className="text-xs font-medium tracking-widest uppercase text-zinc-400">
              Discord Music Engine · {activeGuild.guildName}
            </p>
            <h2
              className="font-display text-3xl lg:text-5xl font-semibold tracking-tight text-zinc-100 leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Where Silence Meets Sound.
            </h2>
            <p className="text-sm lg:text-base text-zinc-400 max-w-2xl leading-relaxed">
              Shadow Music pairs a Discord.js v14 &amp; Lavalink v4 voice engine with SQLite queue
              persistence, custom playlists, DJ role controls, and real-time WebSocket synchronization.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!player.playing) {
                    void onPlayerAction('play');
                  }
                  onNavigate('player');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{player.playing ? 'Open Active Player' : 'Start Audio Session'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('commands')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-zinc-200 border border-zinc-700 rounded-md hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Browse 42 Commands</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 flex justify-start lg:justify-end">
            <div className="w-44 h-44 lg:w-52 lg:h-52 rounded-lg overflow-hidden border border-zinc-700 bg-black shrink-0">
              <ResilientImage
                src="/src/assets/images/samurai_logo_1795268379491.jpg"
                alt="Shadow Music Shogun Samurai Logo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Summary Metrics Row (Clean Flat Hairline Dividers, Tabular Figures) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-zinc-800/80 rounded-lg bg-[#121215] divide-y lg:divide-y-0 lg:divide-x divide-zinc-800/80">
        <div className="p-5 space-y-1">
          <div className="text-xs text-zinc-400">Discord Bot Engine</div>
          <div className="text-lg font-semibold text-zinc-100">
            {status.discordConnected ? 'Connected' : 'Dashboard Studio'}
          </div>
          <div className="text-xs text-zinc-500 font-mono tabular-nums">
            {status.guildCount} {status.guildCount === 1 ? 'server' : 'servers'} · {status.pingMs}ms ping
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs text-zinc-400">Lavalink Audio Node</div>
          <div className="text-lg font-semibold text-zinc-100">
            {status.lavalinkConnected ? status.lavalinkNodeName : 'Standby'}
          </div>
          <div className="text-xs text-zinc-500 font-mono tabular-nums">
            {status.activePlayers} active {status.activePlayers === 1 ? 'player' : 'players'}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs text-zinc-400">Tracks Played</div>
          <div className="text-lg font-semibold text-zinc-100 font-mono tabular-nums">
            {stats.tracksPlayed}
          </div>
          <div className="text-xs text-zinc-500 font-mono tabular-nums">
            {formatMs(stats.totalListeningMs)} total runtime
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs text-zinc-400">Server Configuration</div>
          <div className="text-lg font-semibold text-zinc-100">
            {activeGuild.mode247 ? '24/7 Active' : 'Auto-Idle'}
          </div>
          <div className="text-xs text-zinc-500 font-mono tabular-nums">
            Vol {activeGuild.defaultVolume}% · Prefix {activeGuild.prefix}
          </div>
        </div>
      </section>

      {/* Current Session & Dojo Instrumental Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Active Playback Summary */}
        <section className="lg:col-span-5 border border-zinc-800/80 rounded-lg bg-[#121215] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Now Playing</h3>
            <button
              type="button"
              onClick={() => onNavigate('player')}
              className="text-xs text-zinc-400 hover:text-zinc-100 underline-offset-4 hover:underline"
            >
              Full Console
            </button>
          </div>

          {player.currentTrack ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ResilientImage
                  src={player.currentTrack.artworkUrl}
                  alt={player.currentTrack.title}
                  className="w-20 h-20 rounded-md object-cover border border-zinc-800 shrink-0"
                />
                <div className="min-w-0 space-y-1">
                  <div className="text-base font-semibold text-zinc-100 truncate">
                    {player.currentTrack.title}
                  </div>
                  <div className="text-sm text-zinc-400 truncate">{player.currentTrack.artist}</div>
                  <div className="text-xs text-zinc-500 font-mono tabular-nums">
                    {formatMs(player.positionMs)} / {formatMs(player.currentTrack.durationMs)} · Vol{' '}
                    {player.volume}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onPlayerAction('togglePause')}
                  className="flex-1 py-2 px-4 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white transition-colors"
                >
                  {player.paused || !player.playing ? 'Resume Playback' : 'Pause Playback'}
                </button>
                <button
                  type="button"
                  onClick={() => void onPlayerAction('skip')}
                  className="py-2 px-4 text-xs font-medium text-zinc-200 border border-zinc-700 rounded-md hover:bg-zinc-900 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <Disc3 className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="text-sm text-zinc-400">No track active in {activeGuild.guildName}.</div>
              <button
                type="button"
                onClick={() => void onPlayTrack(catalog[0], true)}
                className="px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white transition-colors"
              >
                Play First Instrumental
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              DJ Role: {activeGuild.djRoleName || 'Everyone'}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
              {player.queue.length} queued
            </span>
          </div>
        </section>

        {/* Curated Dojo Instrumental Library */}
        <section className="lg:col-span-7 border border-zinc-800/80 rounded-lg bg-[#121215] overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Shadow Dojo Audio Library</h3>
              <p className="text-xs text-zinc-500">
                Real-time Web Audio synthesized Japanese instrumentals ready for instant playback
              </p>
            </div>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {catalog.map((track) => {
              const isCurrent = player.currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ResilientImage
                      src={track.artworkUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded object-cover border border-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">
                        {track.title}
                        {isCurrent && (
                          <span className="ml-2 text-xs font-normal text-zinc-400">
                            · {player.playing && !player.paused ? 'Playing' : 'Loaded'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">{track.artist}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-zinc-400 tabular-nums hidden sm:inline">
                      {formatMs(track.durationMs)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void onPlayTrack(track, true)}
                      title="Play now"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-950 rounded hover:bg-white transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onPlayTrack(track, false)}
                      title="Add to queue"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-300 border border-zinc-700 rounded hover:bg-zinc-800 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Queue</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
