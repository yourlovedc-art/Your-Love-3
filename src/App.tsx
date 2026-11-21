import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { webAudioEngine } from './audio/webAudioEngine.ts';
import { ResilientImage } from './components/ResilientImage.tsx';
import { Sidebar, type DashboardSection } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { AboutSection } from './components/sections/AboutSection.tsx';
import { CommandsSection } from './components/sections/CommandsSection.tsx';
import { HomeSection } from './components/sections/HomeSection.tsx';
import { MusicPlayerSection } from './components/sections/MusicPlayerSection.tsx';
import { PlaylistSection } from './components/sections/PlaylistSection.tsx';
import { QueueSection } from './components/sections/QueueSection.tsx';
import { ServersSection } from './components/sections/ServersSection.tsx';
import { SettingsSection } from './components/sections/SettingsSection.tsx';
import { StatisticsSection } from './components/sections/StatisticsSection.tsx';
import type {
  BotCommandMeta,
  FullDashboardState,
  GuildSettings,
  TrackItem,
} from './shared/types.ts';
import { formatMs } from './utils/format.ts';

const SAMURAI_LOGO = '/src/assets/images/samurai_logo_1795268379491.jpg';

export default function App() {
  const [state, setState] = useState<FullDashboardState | null>(null);
  const [commands, setCommands] = useState<BotCommandMeta[]>([]);
  const [activeSection, setActiveSection] = useState<DashboardSection>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const activeGuildRef = useRef<string>('dojo-primary');

  const jsonHeaders: HeadersInit = { 'Content-Type': 'application/json' };

  const loadState = useCallback(async (guildId: string) => {
    const [stateRes, cmdRes] = await Promise.all([
      fetch(`/api/state?guildId=${encodeURIComponent(guildId)}`),
      fetch('/api/commands'),
    ]);
    if (stateRes.ok) {
      const full = (await stateRes.json()) as FullDashboardState;
      setState(full);
      activeGuildRef.current = full.activeGuildId;
    }
    if (cmdRes.ok) {
      const cmdJson = await cmdRes.json();
      setCommands(cmdJson.commands || []);
    }
  }, []);

  // Initial hydration
  useEffect(() => {
    void loadState('dojo-primary');
  }, [loadState]);

  // WebSocket real-time connection
  useEffect(() => {
    let closed = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ type: 'SELECT_GUILD', guildId: activeGuildRef.current }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE_SYNC') {
            setState(msg.payload);
          } else if (msg.type === 'PLAYER_UPDATE') {
            setState((prev) => (prev ? { ...prev, player: msg.payload } : prev));
          } else if (msg.type === 'PLAYER_TICK') {
            setState((prev) =>
              prev && prev.player.guildId === msg.payload.guildId
                ? { ...prev, player: { ...prev.player, positionMs: msg.payload.positionMs } }
                : prev
            );
          } else if (msg.type === 'PLAYLISTS_UPDATE') {
            setState((prev) => (prev ? { ...prev, playlists: msg.payload.playlists } : prev));
          } else if (msg.type === 'FAVORITES_UPDATE') {
            setState((prev) => (prev ? { ...prev, favorites: msg.payload.favorites } : prev));
          } else if (msg.type === 'SETTINGS_UPDATE') {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    guilds: msg.payload.guilds || prev.guilds,
                  }
                : prev
            );
          } else if (msg.type === 'BLACKLIST_UPDATE') {
            setState((prev) => (prev ? { ...prev, blacklist: msg.payload.blacklist } : prev));
          } else if (msg.type === 'GUILDS_UPDATE') {
            setState((prev) => (prev ? { ...prev, guilds: msg.payload } : prev));
          } else if (msg.type === 'STATS_UPDATE') {
            setState((prev) => (prev ? { ...prev, stats: msg.payload } : prev));
          }
        } catch {
          // Ignore invalid socket JSON
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Sync Web Audio Engine with authoritative server state
  useEffect(() => {
    if (!state) return;
    webAudioEngine.sync(
      state.player.currentTrack,
      state.player.playing,
      state.player.paused,
      state.player.volume
    );
  }, [
    state?.player.currentTrack?.id,
    state?.player.playing,
    state?.player.paused,
    state?.player.volume,
  ]);

  const handleSelectGuild = async (guildId: string) => {
    activeGuildRef.current = guildId;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SELECT_GUILD', guildId }));
    }
    await loadState(guildId);
  };

  const handlePlayerAction = async (action: string, value?: unknown) => {
    if (!state) return;
    if (action === 'seek' && typeof value === 'number') {
      webAudioEngine.seek(value);
    }
    const res = await fetch('/api/player/action', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, action, value }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) =>
        prev
          ? {
              ...prev,
              player: data.player,
              history: data.history ?? prev.history,
              stats: data.stats ?? prev.stats,
            }
          : prev
      );
    }
  };

  const handlePlayTrack = async (track: TrackItem, playNow: boolean) => {
    if (!state) return;
    const res = await fetch('/api/queue/add', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, track, playNow }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) =>
        prev
          ? {
              ...prev,
              player: data.player,
              history: data.history ?? prev.history,
              stats: data.stats ?? prev.stats,
            }
          : prev
      );
    }
  };

  const handleRemoveQueueItem = async (index: number) => {
    if (!state) return;
    const res = await fetch('/api/queue/remove', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, index }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, player: data.player } : prev));
    }
  };

  const handleMoveQueueItem = async (from: number, to: number) => {
    if (!state) return;
    const res = await fetch('/api/queue/move', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, from, to }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, player: data.player } : prev));
    }
  };

  const handleUploadAudio = async (file: File) => {
    if (!state) return;
    const reader = new FileReader();
    const base64: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const objectUrl = URL.createObjectURL(file);
    const durationMs: number = await new Promise((resolve) => {
      const audio = new Audio(objectUrl);
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 180000);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(180000);
      };
    });

    const res = await fetch('/api/audio/upload', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        guildId: state.activeGuildId,
        fileName: file.name,
        dataBase64: base64,
        durationMs,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    const data = await res.json();
    setState((prev) =>
      prev ? { ...prev, player: data.player, history: data.history ?? prev.history } : prev
    );
  };

  const handleToggleFavorite = async (track: TrackItem) => {
    if (!state) return;
    const res = await fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, track }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, favorites: data.favorites } : prev));
    }
  };

  const handleCreatePlaylist = async (name: string, description: string) => {
    if (!state) return;
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, name, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create playlist');
    setState((prev) => (prev ? { ...prev, playlists: data.playlists } : prev));
  };

  const handleDeletePlaylist = async (name: string) => {
    if (!state) return;
    const res = await fetch(
      `/api/playlists/${encodeURIComponent(name)}?guildId=${encodeURIComponent(state.activeGuildId)}`,
      { method: 'DELETE', headers: jsonHeaders }
    );
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, playlists: data.playlists } : prev));
    }
  };

  const handleAddTrackToPlaylist = async (playlistName: string, track: TrackItem) => {
    if (!state) return;
    const res = await fetch(`/api/playlists/${encodeURIComponent(playlistName)}/tracks`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, track }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, playlists: data.playlists } : prev));
    }
  };

  const handleRemoveTrackFromPlaylist = async (playlistName: string, index: number) => {
    if (!state) return;
    const res = await fetch(
      `/api/playlists/${encodeURIComponent(playlistName)}/tracks/${index}?guildId=${encodeURIComponent(
        state.activeGuildId
      )}`,
      { method: 'DELETE', headers: jsonHeaders }
    );
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, playlists: data.playlists } : prev));
    }
  };

  const handlePlayPlaylist = async (name: string) => {
    if (!state) return;
    const res = await fetch(`/api/playlists/${encodeURIComponent(name)}/play`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, replace: true }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) =>
        prev ? { ...prev, player: data.player, history: data.history ?? prev.history } : prev
      );
      setActiveSection('player');
    }
  };

  const handleCreateGuild = async (guildName: string) => {
    const res = await fetch('/api/guilds', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildName }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, guilds: data.guilds } : prev));
      await handleSelectGuild(data.guild.guildId);
    }
  };

  const handleSaveSettings = async (updated: Partial<GuildSettings>) => {
    if (!state) return;
    const res = await fetch(`/api/settings/${encodeURIComponent(state.activeGuildId)}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, guilds: data.guilds } : prev));
    }
  };

  const handleResetSettings = async () => {
    if (!state) return;
    const res = await fetch(`/api/settings/${encodeURIComponent(state.activeGuildId)}/reset`, {
      method: 'POST',
      headers: jsonHeaders,
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, guilds: data.guilds } : prev));
    }
  };

  const handleAddBlacklist = async (userId: string, username: string, reason: string) => {
    if (!state) return;
    const res = await fetch('/api/blacklist', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, userId, username, reason }),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, blacklist: data.blacklist } : prev));
    }
  };

  const handleRemoveBlacklist = async (userId: string) => {
    if (!state) return;
    const res = await fetch(
      `/api/blacklist/${encodeURIComponent(userId)}?guildId=${encodeURIComponent(state.activeGuildId)}`,
      { method: 'DELETE', headers: jsonHeaders }
    );
    if (res.ok) {
      const data = await res.json();
      setState((prev) => (prev ? { ...prev, blacklist: data.blacklist } : prev));
    }
  };

  const handleExecuteCommand = async (rawCommand: string) => {
    if (!state) return { ok: false, message: 'Console state not ready.' };
    const res = await fetch('/api/commands/execute', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ guildId: state.activeGuildId, rawCommand }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.error || 'Command failed.' };
    }
    if (data.state) {
      setState(data.state);
    }
    return { ok: true, message: data.message };
  };

  // Samurai Loading Screen
  if (!state) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center p-6 text-center space-y-5">
        <ResilientImage
          src={SAMURAI_LOGO}
          alt="Shadow Music Samurai Emblem"
          className="w-24 h-24 rounded-lg object-cover border border-zinc-700"
        />
        <div className="space-y-1">
          <div className="font-display text-xl font-semibold tracking-widest text-zinc-100">
            SHADOW MUSIC
          </div>
          <div className="text-xs text-zinc-500">Where Silence Meets Sound.</div>
        </div>
      </div>
    );
  }

  const activeGuild =
    state.guilds.find((g) => g.guildId === state.activeGuildId) || state.guilds[0];
  const currentTrack = state.player.currentTrack;
  const isPlaying = Boolean(currentTrack && state.player.playing && !state.player.paused);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100 flex">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        samuraiLogoUrl={SAMURAI_LOGO}
        queueCount={state.player.queue.length}
      />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <TopBar
          activeSection={activeSection}
          guilds={state.guilds}
          activeGuildId={state.activeGuildId}
          onSelectGuild={handleSelectGuild}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          wsConnected={wsConnected}
          discordConnected={state.status.discordConnected}
        />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto pb-24">
          {activeSection === 'home' && (
            <HomeSection
              status={state.status}
              player={state.player}
              activeGuild={activeGuild}
              stats={state.stats}
              catalog={state.catalog}
              onNavigate={setActiveSection}
              onPlayTrack={handlePlayTrack}
              onPlayerAction={handlePlayerAction}
            />
          )}

          {activeSection === 'player' && (
            <MusicPlayerSection
              player={state.player}
              favorites={state.favorites}
              samuraiLogoUrl={SAMURAI_LOGO}
              onPlayerAction={handlePlayerAction}
              onToggleFavorite={handleToggleFavorite}
              onUploadAudio={handleUploadAudio}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'commands' && (
            <CommandsSection commands={commands} onExecuteCommand={handleExecuteCommand} />
          )}

          {activeSection === 'queue' && (
            <QueueSection
              player={state.player}
              history={state.history}
              catalog={state.catalog}
              onPlayerAction={handlePlayerAction}
              onAddTrack={handlePlayTrack}
              onRemoveQueueItem={handleRemoveQueueItem}
              onMoveQueueItem={handleMoveQueueItem}
            />
          )}

          {activeSection === 'playlist' && (
            <PlaylistSection
              playlists={state.playlists}
              favorites={state.favorites}
              currentTrack={currentTrack}
              catalog={state.catalog}
              onCreatePlaylist={handleCreatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onAddTrackToPlaylist={handleAddTrackToPlaylist}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onPlayPlaylist={handlePlayPlaylist}
              onPlayTrack={handlePlayTrack}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeSection === 'servers' && (
            <ServersSection
              guilds={state.guilds}
              activeGuildId={state.activeGuildId}
              status={state.status}
              samuraiLogoUrl={SAMURAI_LOGO}
              onSelectGuild={handleSelectGuild}
              onCreateGuild={handleCreateGuild}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsSection
              settings={activeGuild}
              blacklist={state.blacklist}
              onSaveSettings={handleSaveSettings}
              onResetSettings={handleResetSettings}
              onAddBlacklist={handleAddBlacklist}
              onRemoveBlacklist={handleRemoveBlacklist}
            />
          )}

          {activeSection === 'statistics' && (
            <StatisticsSection stats={state.stats} status={state.status} />
          )}

          {activeSection === 'about' && (
            <AboutSection status={state.status} samuraiLogoUrl={SAMURAI_LOGO} />
          )}
        </main>

        {/* Compact Mini Audio Bar when away from Music Player */}
        {activeSection !== 'player' && currentTrack && (
          <div className="sticky bottom-0 z-20 bg-[#0D0D0F]/95 backdrop-blur-sm border-t border-zinc-800 px-4 lg:px-8 py-2.5 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('player')}
              className="flex items-center gap-3 min-w-0 text-left"
            >
              <ResilientImage
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                className="w-9 h-9 rounded object-cover border border-zinc-800 shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-100 truncate">
                  {currentTrack.title}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {currentTrack.artist} ·{' '}
                  <span className="font-mono tabular-nums">
                    {formatMs(state.player.positionMs)} / {formatMs(currentTrack.durationMs)}
                  </span>
                </div>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handlePlayerAction('togglePause')}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="p-2 rounded bg-zinc-100 text-zinc-950 hover:bg-white transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>
              <button
                type="button"
                onClick={() => void handlePlayerAction('skip')}
                aria-label="Skip track"
                className="p-2 rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-900 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
