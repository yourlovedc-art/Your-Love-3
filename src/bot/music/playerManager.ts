import { EventEmitter } from 'events';
import type { Kazagumo, KazagumoPlayer, KazagumoTrack } from 'kazagumo';
import type {
  GuildPlayerState,
  GuildSettings,
  LoopMode,
  TrackItem,
  TrackRequester,
} from '../../shared/types.ts';
import { BUILTIN_CATALOG, SAMURAI_LOGO_URL, ShadowDatabase } from '../database/sqlite.ts';

export class GuildMusicBridge extends EventEmitter {
  private db: ShadowDatabase;
  private kazagumo: Kazagumo | null = null;
  private states = new Map<string, GuildPlayerState>();
  private voteSkipVoters = new Map<string, Set<string>>();
  private inactivityTimers = new Map<string, NodeJS.Timeout>();
  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickAt = Date.now();

  constructor(db: ShadowDatabase) {
    super();
    this.db = db;
    this.restorePersistedQueues();
    this.startProgressTicker();
  }

  attachKazagumo(kazagumo: Kazagumo) {
    this.kazagumo = kazagumo;
  }

  private restorePersistedQueues() {
    const guilds = this.db.getAllGuilds();
    for (const guild of guilds) {
      const saved = this.db.loadQueueSnapshot<GuildPlayerState>(guild.guildId);
      if (saved) {
        this.states.set(guild.guildId, {
          ...saved,
          playing: false,
          paused: Boolean(saved.currentTrack),
          updatedAt: Date.now(),
        });
      } else {
        const defaultTracks = BUILTIN_CATALOG.slice(0, 3);
        const initial: GuildPlayerState = {
          guildId: guild.guildId,
          guildName: guild.guildName,
          voiceChannelName: 'Dojo Voice I',
          textChannelName: guild.musicChannelName || '#shadow-music',
          connected: guild.mode247,
          playing: false,
          paused: false,
          positionMs: 0,
          volume: guild.defaultVolume,
          loop: 'off',
          shuffle: false,
          autoplay: guild.autoplay,
          voteSkipCount: 0,
          voteSkipRequired: 1,
          currentTrack: defaultTracks[0],
          queue: defaultTracks.slice(1),
          previousTracks: [],
          updatedAt: Date.now(),
        };
        this.states.set(guild.guildId, initial);
      }
    }
  }

  private startProgressTicker() {
    this.lastTickAt = Date.now();
    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastTickAt;
      this.lastTickAt = now;

      for (const [guildId, state] of this.states.entries()) {
        // If live Kazagumo player is active, sync its authoritative position
        const kazaPlayer = this.kazagumo?.getPlayer(guildId);
        if (kazaPlayer && kazaPlayer.queue.current) {
          const changed =
            state.playing !== kazaPlayer.playing ||
            state.paused !== kazaPlayer.paused ||
            state.volume !== kazaPlayer.volume;
          state.positionMs = kazaPlayer.position;
          state.playing = kazaPlayer.playing;
          state.paused = kazaPlayer.paused;
          state.volume = kazaPlayer.volume;
          if (changed) {
            this.emitState(guildId);
          } else {
            this.emit('player:tick', { guildId, positionMs: state.positionMs });
          }
          continue;
        }

        if (state.playing && !state.paused && state.currentTrack) {
          state.positionMs += delta;
          if (state.currentTrack.durationMs > 0 && state.positionMs >= state.currentTrack.durationMs) {
            void this.handleTrackFinished(guildId);
          } else {
            this.emit('player:tick', { guildId, positionMs: state.positionMs });
          }
        }
      }
    }, 1000);
  }

  stopTicker() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  getPlayerState(guildId: string, fallbackName = 'Shadow Dojo Sanctuary'): GuildPlayerState {
    let state = this.states.get(guildId);
    if (!state) {
      const settings = this.db.getGuildSettings(guildId, fallbackName);
      state = {
        guildId,
        guildName: settings.guildName,
        voiceChannelName: 'Voice Channel',
        textChannelName: settings.musicChannelName || '#shadow-music',
        connected: settings.mode247,
        playing: false,
        paused: false,
        positionMs: 0,
        volume: settings.defaultVolume,
        loop: 'off',
        shuffle: false,
        autoplay: settings.autoplay,
        voteSkipCount: 0,
        voteSkipRequired: 1,
        currentTrack: null,
        queue: [],
        previousTracks: [],
        updatedAt: Date.now(),
      };
      this.states.set(guildId, state);
    }
    return state;
  }

  getActivePlayersCount(): number {
    let count = 0;
    for (const s of this.states.values()) {
      if (s.playing && !s.paused && s.currentTrack) count++;
    }
    return count;
  }

  private persistAndBroadcast(guildId: string) {
    const state = this.getPlayerState(guildId);
    state.updatedAt = Date.now();
    this.db.saveQueueSnapshot(guildId, state);
    this.emitState(guildId);
  }

  private emitState(guildId: string) {
    const state = this.getPlayerState(guildId);
    this.emit('player:update', state);
  }

  private clearInactivityTimer(guildId: string) {
    const existing = this.inactivityTimers.get(guildId);
    if (existing) {
      clearTimeout(existing);
      this.inactivityTimers.delete(guildId);
    }
  }

  scheduleInactivityDisconnect(guildId: string) {
    this.clearInactivityTimer(guildId);
    const settings = this.db.getGuildSettings(guildId);
    if (settings.mode247) return;
    const timeoutMs = Math.max(30, settings.inactivityTimeoutSec) * 1000;
    const timer = setTimeout(() => {
      const state = this.getPlayerState(guildId);
      if (!state.playing && !settings.mode247) {
        state.connected = false;
        const kazaPlayer = this.kazagumo?.getPlayer(guildId);
        if (kazaPlayer) {
          void kazaPlayer.destroy().catch(() => {});
        }
        this.persistAndBroadcast(guildId);
      }
    }, timeoutMs);
    this.inactivityTimers.set(guildId, timer);
  }

  async enqueueTrack(guildId: string, track: TrackItem, playImmediately = false): Promise<GuildPlayerState> {
    this.clearInactivityTimer(guildId);
    const state = this.getPlayerState(guildId);
    state.connected = true;

    if (!state.currentTrack || playImmediately) {
      if (state.currentTrack) {
        state.previousTracks.unshift(state.currentTrack);
        state.previousTracks = state.previousTracks.slice(0, 25);
      }
      state.currentTrack = track;
      state.positionMs = 0;
      state.playing = true;
      state.paused = false;
      this.voteSkipVoters.delete(guildId);
      state.voteSkipCount = 0;
      this.db.recordHistory(guildId, track);
    } else {
      state.queue.push(track);
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  async enqueueMany(guildId: string, tracks: TrackItem[], replaceCurrent = false): Promise<GuildPlayerState> {
    if (tracks.length === 0) return this.getPlayerState(guildId);
    this.clearInactivityTimer(guildId);
    const state = this.getPlayerState(guildId);
    state.connected = true;

    if (!state.currentTrack || replaceCurrent) {
      if (replaceCurrent && state.currentTrack) {
        state.previousTracks.unshift(state.currentTrack);
      }
      state.currentTrack = tracks[0];
      state.positionMs = 0;
      state.playing = true;
      state.paused = false;
      state.queue = replaceCurrent ? tracks.slice(1) : [...tracks.slice(1), ...state.queue];
      this.db.recordHistory(guildId, tracks[0]);
    } else {
      state.queue.push(...tracks);
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  async togglePause(guildId: string, forcePause?: boolean): Promise<GuildPlayerState> {
    const state = this.getPlayerState(guildId);
    if (!state.currentTrack) return state;

    const nextPaused = typeof forcePause === 'boolean' ? forcePause : !state.paused;
    state.paused = nextPaused;
    state.playing = !nextPaused;

    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer) {
      kazaPlayer.pause(nextPaused);
    }

    if (nextPaused) {
      this.scheduleInactivityDisconnect(guildId);
    } else {
      this.clearInactivityTimer(guildId);
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  async playCurrentOrFirst(guildId: string): Promise<GuildPlayerState> {
    const state = this.getPlayerState(guildId);
    if (!state.currentTrack && state.queue.length > 0) {
      state.currentTrack = state.queue.shift()!;
      state.positionMs = 0;
      this.db.recordHistory(guildId, state.currentTrack);
    } else if (!state.currentTrack && state.queue.length === 0) {
      const recommended = this.getRelatedTrack(guildId, null);
      if (recommended) {
        state.currentTrack = recommended;
        state.positionMs = 0;
        this.db.recordHistory(guildId, recommended);
      }
    }
    if (state.currentTrack) {
      state.connected = true;
      state.playing = true;
      state.paused = false;
      this.clearInactivityTimer(guildId);
      const kazaPlayer = this.kazagumo?.getPlayer(guildId);
      if (kazaPlayer && kazaPlayer.paused) {
        kazaPlayer.pause(false);
      }
    }
    this.persistAndBroadcast(guildId);
    return state;
  }

  async skip(guildId: string): Promise<GuildPlayerState> {
    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer && kazaPlayer.queue.current) {
      try {
        kazaPlayer.skip();
      } catch {
        // Ignore if player already stopped or destroyed
      }
    }
    return this.advanceTrack(guildId, true);
  }

  castVoteSkip(guildId: string, userId: string, listenerCount: number): { skipped: boolean; count: number; required: number } {
    const settings = this.db.getGuildSettings(guildId);
    const required = Math.max(1, Math.ceil(listenerCount * settings.voteSkipRatio));
    let voters = this.voteSkipVoters.get(guildId);
    if (!voters) {
      voters = new Set<string>();
      this.voteSkipVoters.set(guildId, voters);
    }
    voters.add(userId);
    const state = this.getPlayerState(guildId);
    state.voteSkipCount = voters.size;
    state.voteSkipRequired = required;
    this.emitState(guildId);

    if (voters.size >= required) {
      void this.skip(guildId);
      return { skipped: true, count: voters.size, required };
    }
    return { skipped: false, count: voters.size, required };
  }

  private async handleTrackFinished(guildId: string) {
    await this.advanceTrack(guildId, false);
  }

  private async advanceTrack(guildId: string, manualSkip: boolean): Promise<GuildPlayerState> {
    const state = this.getPlayerState(guildId);
    this.voteSkipVoters.delete(guildId);
    state.voteSkipCount = 0;

    if (state.currentTrack) {
      if (!manualSkip && state.loop === 'song') {
        state.positionMs = 0;
        state.playing = true;
        state.paused = false;
        this.persistAndBroadcast(guildId);
        return state;
      }

      if (state.loop === 'queue') {
        state.queue.push(state.currentTrack);
      }

      state.previousTracks.unshift(state.currentTrack);
      state.previousTracks = state.previousTracks.slice(0, 25);
    }

    if (state.queue.length > 0) {
      state.currentTrack = state.queue.shift()!;
      state.positionMs = 0;
      state.playing = true;
      state.paused = false;
      this.db.recordHistory(guildId, state.currentTrack);
      this.clearInactivityTimer(guildId);
    } else if (state.autoplay) {
      const nextRec = this.getRelatedTrack(guildId, state.currentTrack);
      if (nextRec) {
        state.currentTrack = nextRec;
        state.positionMs = 0;
        state.playing = true;
        state.paused = false;
        this.db.recordHistory(guildId, nextRec);
        this.clearInactivityTimer(guildId);
      } else {
        state.currentTrack = null;
        state.positionMs = 0;
        state.playing = false;
        state.paused = false;
        this.scheduleInactivityDisconnect(guildId);
      }
    } else {
      state.currentTrack = null;
      state.positionMs = 0;
      state.playing = false;
      state.paused = false;
      this.scheduleInactivityDisconnect(guildId);
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  async previous(guildId: string): Promise<GuildPlayerState> {
    const state = this.getPlayerState(guildId);
    if (state.previousTracks.length === 0) {
      state.positionMs = 0;
      this.persistAndBroadcast(guildId);
      return state;
    }

    const prev = state.previousTracks.shift()!;
    if (state.currentTrack) {
      state.queue.unshift(state.currentTrack);
    }
    state.currentTrack = prev;
    state.positionMs = 0;
    state.playing = true;
    state.paused = false;
    this.db.recordHistory(guildId, prev);

    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer) {
      const kazaPrev = kazaPlayer.getPrevious(true);
      if (kazaPrev) {
        await kazaPlayer.play(kazaPrev);
      }
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  async stop(guildId: string, disconnect = false): Promise<GuildPlayerState> {
    const state = this.getPlayerState(guildId);
    const settings = this.db.getGuildSettings(guildId);
    if (state.currentTrack) {
      state.previousTracks.unshift(state.currentTrack);
      state.previousTracks = state.previousTracks.slice(0, 25);
    }
    state.currentTrack = null;
    state.queue = [];
    state.positionMs = 0;
    state.playing = false;
    state.paused = false;
    if (disconnect && !settings.mode247) {
      state.connected = false;
    }

    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer) {
      kazaPlayer.queue.clear();
      try {
        if (disconnect && !settings.mode247) {
          await kazaPlayer.destroy();
        } else if (kazaPlayer.queue.current) {
          kazaPlayer.skip();
        }
      } catch {
        // Ignore if player already disconnected or destroyed
      }
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  async setVolume(guildId: string, volume: number): Promise<GuildPlayerState> {
    const clamped = Math.max(1, Math.min(100, Math.round(volume)));
    const state = this.getPlayerState(guildId);
    state.volume = clamped;

    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer) {
      await kazaPlayer.setVolume(clamped);
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  async seek(guildId: string, positionMs: number): Promise<GuildPlayerState> {
    const state = this.getPlayerState(guildId);
    if (!state.currentTrack) return state;
    const clamped = Math.max(0, Math.min(state.currentTrack.durationMs || positionMs, Math.round(positionMs)));
    state.positionMs = clamped;

    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer && kazaPlayer.queue.current) {
      await kazaPlayer.seek(clamped);
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  cycleLoop(guildId: string, explicitMode?: LoopMode): GuildPlayerState {
    const state = this.getPlayerState(guildId);
    const order: LoopMode[] = ['off', 'song', 'queue'];
    const nextMode = explicitMode ?? order[(order.indexOf(state.loop) + 1) % order.length];
    state.loop = nextMode;

    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer) {
      kazaPlayer.setLoop(nextMode === 'off' ? 'none' : nextMode === 'song' ? 'track' : 'queue');
    }

    this.persistAndBroadcast(guildId);
    return state;
  }

  toggleShuffle(guildId: string): GuildPlayerState {
    const state = this.getPlayerState(guildId);
    state.shuffle = !state.shuffle;
    if (state.queue.length > 1) {
      for (let i = state.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
      }
      const kazaPlayer = this.kazagumo?.getPlayer(guildId);
      if (kazaPlayer) {
        kazaPlayer.queue.shuffle();
      }
    }
    this.persistAndBroadcast(guildId);
    return state;
  }

  toggleAutoplay(guildId: string, enabled?: boolean): GuildPlayerState {
    const state = this.getPlayerState(guildId);
    state.autoplay = typeof enabled === 'boolean' ? enabled : !state.autoplay;
    const settings = this.db.getGuildSettings(guildId);
    this.db.upsertGuildSettings({ ...settings, autoplay: state.autoplay });
    this.persistAndBroadcast(guildId);
    return state;
  }

  clearQueue(guildId: string): GuildPlayerState {
    const state = this.getPlayerState(guildId);
    state.queue = [];
    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer) {
      kazaPlayer.queue.clear();
    }
    this.persistAndBroadcast(guildId);
    return state;
  }

  removeQueueItem(guildId: string, index: number): TrackItem | null {
    const state = this.getPlayerState(guildId);
    if (index < 0 || index >= state.queue.length) return null;
    const [removed] = state.queue.splice(index, 1);
    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer && index < kazaPlayer.queue.length) {
      kazaPlayer.queue.remove(index);
    }
    this.persistAndBroadcast(guildId);
    return removed;
  }

  moveQueueItem(guildId: string, fromIndex: number, toIndex: number): boolean {
    const state = this.getPlayerState(guildId);
    if (
      fromIndex < 0 ||
      fromIndex >= state.queue.length ||
      toIndex < 0 ||
      toIndex >= state.queue.length
    ) {
      return false;
    }
    const [item] = state.queue.splice(fromIndex, 1);
    state.queue.splice(toIndex, 0, item);

    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer && fromIndex < kazaPlayer.queue.length && toIndex < kazaPlayer.queue.length) {
      const [kItem] = kazaPlayer.queue.splice(fromIndex, 1);
      if (kItem) kazaPlayer.queue.splice(toIndex, 0, kItem);
    }

    this.persistAndBroadcast(guildId);
    return true;
  }

  async jumpToQueueIndex(guildId: string, index: number): Promise<GuildPlayerState> {
    const state = this.getPlayerState(guildId);
    if (index < 0 || index >= state.queue.length) return state;

    const kazaPlayer = this.kazagumo?.getPlayer(guildId);
    if (kazaPlayer && index < kazaPlayer.queue.length) {
      if (index > 0) {
        kazaPlayer.queue.splice(0, index);
      }
      kazaPlayer.skip();
    }

    if (state.currentTrack) {
      state.previousTracks.unshift(state.currentTrack);
    }
    const skipped = state.queue.splice(0, index);
    state.previousTracks.unshift(...skipped.reverse());
    state.previousTracks = state.previousTracks.slice(0, 25);
    const target = state.queue.shift()!;
    state.currentTrack = target;
    state.positionMs = 0;
    state.playing = true;
    state.paused = false;
    this.db.recordHistory(guildId, target);
    this.persistAndBroadcast(guildId);
    return state;
  }

  syncFromKazagumoPlayer(player: KazagumoPlayer, guildName: string) {
    const state = this.getPlayerState(player.guildId, guildName);
    const toTrackItem = (kt: KazagumoTrack): TrackItem => ({
      id: kt.identifier || kt.uri || `kaza_${Date.now()}`,
      title: kt.title,
      artist: kt.author || 'Unknown Artist',
      durationMs: kt.length || 0,
      artworkUrl: kt.thumbnail || SAMURAI_LOGO_URL,
      uri: kt.uri || '',
      source: 'lavalink',
      requestedBy: (kt.requester as TrackRequester) || { id: 'discord', username: 'Discord User' },
      addedAt: Date.now(),
    });

    state.guildName = guildName;
    state.connected = true;
    state.playing = player.playing;
    state.paused = player.paused;
    state.positionMs = player.position;
    state.volume = player.volume;
    state.loop = player.loop === 'track' ? 'song' : player.loop === 'queue' ? 'queue' : 'off';
    state.currentTrack = player.queue.current ? toTrackItem(player.queue.current) : null;
    state.queue = player.queue.map(toTrackItem);
    this.persistAndBroadcast(player.guildId);
  }

  getRelatedTrack(guildId: string, seedTrack: TrackItem | null): TrackItem | null {
    const pool = [...BUILTIN_CATALOG];
    const filtered = seedTrack ? pool.filter((t) => t.id !== seedTrack.id) : pool;
    if (filtered.length === 0) return pool[0] || null;
    const chosen = filtered[Math.floor(Math.random() * filtered.length)];
    return {
      ...chosen,
      id: `${chosen.id}_${Date.now()}`,
      requestedBy: { id: 'autoplay', username: 'Autoplay' },
      addedAt: Date.now(),
    };
  }

  applyGuildSettingsUpdate(settings: GuildSettings) {
    const state = this.getPlayerState(settings.guildId, settings.guildName);
    state.guildName = settings.guildName;
    state.autoplay = settings.autoplay;
    if (settings.musicChannelName) {
      state.textChannelName = settings.musicChannelName;
    }
    this.emitState(settings.guildId);
  }
}
