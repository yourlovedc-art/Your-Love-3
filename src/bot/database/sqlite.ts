import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type {
  BlacklistEntry,
  BotStatsSnapshot,
  FavoriteEntry,
  GuildSettings,
  HistoryEntry,
  PlaylistRecord,
  TrackItem,
} from '../../shared/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'shadow_music.db');

export const SAMURAI_LOGO_URL = '/src/assets/images/samurai_logo_1795268379491.jpg';

export const BUILTIN_CATALOG: TrackItem[] = [
  {
    id: 'samurai-koto-01',
    title: 'Moonlight Over Kamakura',
    artist: 'Koto & Rain Ensemble',
    durationMs: 184000,
    artworkUrl: '/src/assets/images/album_art_koto_1795268378378.jpg',
    uri: 'synth://kamakura-moonlight',
    source: 'synth',
    synthPreset: 'kamakura',
    requestedBy: { id: 'system', username: 'Shadow Dojo' },
    addedAt: Date.now(),
  },
  {
    id: 'samurai-ronin-02',
    title: 'Torii in Autumn Mist',
    artist: 'Shakuhachi Collective',
    durationMs: 212000,
    artworkUrl: '/src/assets/images/album_art_ronin_1795268378915.jpg',
    uri: 'synth://torii-autumn-mist',
    source: 'synth',
    synthPreset: 'torii',
    requestedBy: { id: 'system', username: 'Shadow Dojo' },
    addedAt: Date.now(),
  },
  {
    id: 'samurai-zen-03',
    title: 'Enso — Silent Blade',
    artist: 'Kyoto Lo-Fi Temple',
    durationMs: 168000,
    artworkUrl: '/src/assets/images/album_art_zen_1795268378812.jpg',
    uri: 'synth://enso-silent-blade',
    source: 'synth',
    synthPreset: 'enso',
    requestedBy: { id: 'system', username: 'Shadow Dojo' },
    addedAt: Date.now(),
  },
  {
    id: 'samurai-taiko-04',
    title: 'Midnight Watch at Edo Castle',
    artist: 'Taiko & Shamisen Studio',
    durationMs: 196000,
    artworkUrl: '/src/assets/images/samurai_logo_1795268379491.jpg',
    uri: 'synth://edo-midnight-watch',
    source: 'synth',
    synthPreset: 'edo',
    requestedBy: { id: 'system', username: 'Shadow Dojo' },
    addedAt: Date.now(),
  },
  {
    id: 'samurai-bamboo-05',
    title: 'Wind Through Arashiyama',
    artist: 'Koto & Rain Ensemble',
    durationMs: 224000,
    artworkUrl: '/src/assets/images/album_art_koto_1795268378378.jpg',
    uri: 'synth://arashiyama-wind',
    source: 'synth',
    synthPreset: 'arashiyama',
    requestedBy: { id: 'system', username: 'Shadow Dojo' },
    addedAt: Date.now(),
  },
  {
    id: 'samurai-shogun-06',
    title: 'Steel & Ink (Instrumental)',
    artist: 'Shogun Soundworks',
    durationMs: 178000,
    artworkUrl: '/src/assets/images/album_art_ronin_1795268378915.jpg',
    uri: 'synth://steel-and-ink',
    source: 'synth',
    synthPreset: 'shogun',
    requestedBy: { id: 'system', username: 'Shadow Dojo' },
    addedAt: Date.now(),
  },
];

export class ShadowDatabase {
  private db: Database.Database;

  constructor(dbPath: string = DB_PATH) {
    if (!fs.existsSync(path.dirname(dbPath))) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
    this.seedDefaults();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        guild_name TEXT NOT NULL,
        guild_icon TEXT,
        mode_247 INTEGER NOT NULL DEFAULT 0,
        dj_role_id TEXT,
        dj_role_name TEXT,
        prefix TEXT NOT NULL DEFAULT '!',
        music_channel_id TEXT,
        music_channel_name TEXT,
        default_volume INTEGER NOT NULL DEFAULT 75,
        autoplay INTEGER NOT NULL DEFAULT 1,
        vote_skip_enabled INTEGER NOT NULL DEFAULT 1,
        vote_skip_ratio REAL NOT NULL DEFAULT 0.5,
        inactivity_timeout_sec INTEGER NOT NULL DEFAULT 300,
        custom_status TEXT NOT NULL DEFAULT 'Where Silence Meets Sound.',
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(guild_id, name)
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        track_json TEXT NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS music_history (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        track_json TEXT NOT NULL,
        played_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        track_json TEXT NOT NULL,
        saved_at INTEGER NOT NULL,
        UNIQUE(guild_id, user_id, track_id)
      );

      CREATE TABLE IF NOT EXISTS blacklisted_users (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT 'Restricted by server admin',
        added_by TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS guild_queues (
        guild_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stats_counters (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS command_usage (
        command_name TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS track_play_counts (
        track_key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        artwork_url TEXT NOT NULL,
        plays INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  private seedDefaults() {
    const guildCount = this.db.prepare('SELECT COUNT(*) as cnt FROM guild_settings').get() as { cnt: number };
    if (guildCount.cnt === 0) {
      this.upsertGuildSettings({
        guildId: 'dojo-primary',
        guildName: 'Shadow Dojo Sanctuary',
        guildIcon: SAMURAI_LOGO_URL,
        mode247: true,
        djRoleId: null,
        djRoleName: 'Shogun DJ',
        prefix: '!',
        musicChannelId: null,
        musicChannelName: '#shadow-music',
        defaultVolume: 75,
        autoplay: true,
        voteSkipEnabled: true,
        voteSkipRatio: 0.5,
        inactivityTimeoutSec: 300,
        customStatus: 'Where Silence Meets Sound.',
        updatedAt: Date.now(),
      });

      this.createPlaylist(
        'dojo-primary',
        'system',
        'Shadow Dojo',
        'Midnight Ink & Koto',
        'Curated monochrome instrumentals for late-night focus.',
        BUILTIN_CATALOG.slice(0, 4)
      );
    }

    const statsInit = this.db.prepare('INSERT OR IGNORE INTO stats_counters (key, value) VALUES (?, 0)');
    statsInit.run('tracks_played');
    statsInit.run('commands_executed');
    statsInit.run('total_listening_ms');
  }

  getAllGuilds(): GuildSettings[] {
    const rows = this.db.prepare('SELECT * FROM guild_settings ORDER BY updated_at DESC').all() as any[];
    return rows.map(this.mapGuildRow);
  }

  getGuildSettings(guildId: string, fallbackName = 'Discord Guild'): GuildSettings {
    const row = this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) as any;
    if (row) return this.mapGuildRow(row);
    const created: GuildSettings = {
      guildId,
      guildName: fallbackName,
      guildIcon: null,
      mode247: false,
      djRoleId: null,
      djRoleName: null,
      prefix: '!',
      musicChannelId: null,
      musicChannelName: null,
      defaultVolume: 75,
      autoplay: true,
      voteSkipEnabled: true,
      voteSkipRatio: 0.5,
      inactivityTimeoutSec: 300,
      customStatus: 'Where Silence Meets Sound.',
      updatedAt: Date.now(),
    };
    this.upsertGuildSettings(created);
    return created;
  }

  upsertGuildSettings(settings: GuildSettings): GuildSettings {
    const stmt = this.db.prepare(`
      INSERT INTO guild_settings (
        guild_id, guild_name, guild_icon, mode_247, dj_role_id, dj_role_name,
        prefix, music_channel_id, music_channel_name, default_volume,
        autoplay, vote_skip_enabled, vote_skip_ratio, inactivity_timeout_sec,
        custom_status, updated_at
      ) VALUES (
        @guildId, @guildName, @guildIcon, @mode247, @djRoleId, @djRoleName,
        @prefix, @musicChannelId, @musicChannelName, @defaultVolume,
        @autoplay, @voteSkipEnabled, @voteSkipRatio, @inactivityTimeoutSec,
        @customStatus, @updatedAt
      )
      ON CONFLICT(guild_id) DO UPDATE SET
        guild_name = excluded.guild_name,
        guild_icon = COALESCE(excluded.guild_icon, guild_settings.guild_icon),
        mode_247 = excluded.mode_247,
        dj_role_id = excluded.dj_role_id,
        dj_role_name = excluded.dj_role_name,
        prefix = excluded.prefix,
        music_channel_id = excluded.music_channel_id,
        music_channel_name = excluded.music_channel_name,
        default_volume = excluded.default_volume,
        autoplay = excluded.autoplay,
        vote_skip_enabled = excluded.vote_skip_enabled,
        vote_skip_ratio = excluded.vote_skip_ratio,
        inactivity_timeout_sec = excluded.inactivity_timeout_sec,
        custom_status = excluded.custom_status,
        updated_at = excluded.updated_at
    `);
    stmt.run({
      guildId: settings.guildId,
      guildName: settings.guildName,
      guildIcon: settings.guildIcon,
      mode247: settings.mode247 ? 1 : 0,
      djRoleId: settings.djRoleId,
      djRoleName: settings.djRoleName,
      prefix: settings.prefix,
      musicChannelId: settings.musicChannelId,
      musicChannelName: settings.musicChannelName,
      defaultVolume: Math.max(1, Math.min(100, Math.round(settings.defaultVolume))),
      autoplay: settings.autoplay ? 1 : 0,
      voteSkipEnabled: settings.voteSkipEnabled ? 1 : 0,
      voteSkipRatio: settings.voteSkipRatio,
      inactivityTimeoutSec: settings.inactivityTimeoutSec,
      customStatus: settings.customStatus,
      updatedAt: Date.now(),
    });
    return this.getGuildSettings(settings.guildId);
  }

  resetGuildSettings(guildId: string): GuildSettings {
    const existing = this.getGuildSettings(guildId);
    return this.upsertGuildSettings({
      ...existing,
      mode247: false,
      djRoleId: null,
      djRoleName: null,
      prefix: '!',
      musicChannelId: null,
      musicChannelName: null,
      defaultVolume: 75,
      autoplay: true,
      voteSkipEnabled: true,
      voteSkipRatio: 0.5,
      inactivityTimeoutSec: 300,
      customStatus: 'Where Silence Meets Sound.',
      updatedAt: Date.now(),
    });
  }

  private mapGuildRow(row: any): GuildSettings {
    return {
      guildId: row.guild_id,
      guildName: row.guild_name,
      guildIcon: row.guild_icon,
      mode247: Boolean(row.mode_247),
      djRoleId: row.dj_role_id,
      djRoleName: row.dj_role_name,
      prefix: row.prefix,
      musicChannelId: row.music_channel_id,
      musicChannelName: row.music_channel_name,
      defaultVolume: row.default_volume,
      autoplay: Boolean(row.autoplay),
      voteSkipEnabled: Boolean(row.vote_skip_enabled),
      voteSkipRatio: row.vote_skip_ratio,
      inactivityTimeoutSec: row.inactivity_timeout_sec,
      customStatus: row.custom_status,
      updatedAt: row.updated_at,
    };
  }

  // Playlists
  getPlaylists(guildId: string): PlaylistRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM playlists WHERE guild_id = ? ORDER BY updated_at DESC')
      .all(guildId) as any[];
    const trackStmt = this.db.prepare(
      'SELECT track_json FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC'
    );
    return rows.map((row) => {
      const trackRows = trackStmt.all(row.id) as any[];
      return {
        id: row.id,
        guildId: row.guild_id,
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        name: row.name,
        description: row.description,
        tracks: trackRows.map((t) => JSON.parse(t.track_json)),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  getPlaylistByName(guildId: string, name: string): PlaylistRecord | null {
    const row = this.db
      .prepare('SELECT * FROM playlists WHERE guild_id = ? AND LOWER(name) = LOWER(?)')
      .get(guildId, name.trim()) as any;
    if (!row) return null;
    const trackRows = this.db
      .prepare('SELECT track_json FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC')
      .all(row.id) as any[];
    return {
      id: row.id,
      guildId: row.guild_id,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      name: row.name,
      description: row.description,
      tracks: trackRows.map((t) => JSON.parse(t.track_json)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  createPlaylist(
    guildId: string,
    ownerId: string,
    ownerName: string,
    name: string,
    description = '',
    initialTracks: TrackItem[] = []
  ): PlaylistRecord {
    const cleanName = name.trim();
    const existing = this.getPlaylistByName(guildId, cleanName);
    if (existing) {
      throw new Error(`Playlist "${cleanName}" already exists.`);
    }
    const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    this.db
      .prepare(
        'INSERT INTO playlists (id, guild_id, owner_id, owner_name, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(id, guildId, ownerId, ownerName, cleanName, description.trim(), now, now);

    const insertTrack = this.db.prepare(
      'INSERT INTO playlist_tracks (id, playlist_id, position, track_json) VALUES (?, ?, ?, ?)'
    );
    initialTracks.forEach((track, idx) => {
      insertTrack.run(`plt_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`, id, idx, JSON.stringify(track));
    });

    return this.getPlaylistByName(guildId, cleanName)!;
  }

  deletePlaylist(guildId: string, name: string): boolean {
    const res = this.db
      .prepare('DELETE FROM playlists WHERE guild_id = ? AND LOWER(name) = LOWER(?)')
      .run(guildId, name.trim());
    return res.changes > 0;
  }

  addTrackToPlaylist(guildId: string, name: string, track: TrackItem): PlaylistRecord {
    const pl = this.getPlaylistByName(guildId, name);
    if (!pl) throw new Error(`Playlist "${name}" not found.`);
    const nextPos = pl.tracks.length;
    this.db
      .prepare('INSERT INTO playlist_tracks (id, playlist_id, position, track_json) VALUES (?, ?, ?, ?)')
      .run(`plt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, pl.id, nextPos, JSON.stringify(track));
    this.db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), pl.id);
    return this.getPlaylistByName(guildId, name)!;
  }

  removeTrackFromPlaylist(guildId: string, name: string, positionIndex: number): PlaylistRecord {
    const pl = this.getPlaylistByName(guildId, name);
    if (!pl) throw new Error(`Playlist "${name}" not found.`);
    if (positionIndex < 0 || positionIndex >= pl.tracks.length) {
      throw new Error(`Invalid track position ${positionIndex + 1}.`);
    }
    const updated = pl.tracks.filter((_, idx) => idx !== positionIndex);
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(pl.id);
      const insert = this.db.prepare(
        'INSERT INTO playlist_tracks (id, playlist_id, position, track_json) VALUES (?, ?, ?, ?)'
      );
      updated.forEach((t, idx) => {
        insert.run(`plt_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`, pl.id, idx, JSON.stringify(t));
      });
      this.db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), pl.id);
    });
    tx();
    return this.getPlaylistByName(guildId, name)!;
  }

  // History
  recordHistory(guildId: string, track: TrackItem) {
    const id = `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.db
      .prepare('INSERT INTO music_history (id, guild_id, track_json, played_at) VALUES (?, ?, ?, ?)')
      .run(id, guildId, JSON.stringify(track), Date.now());
    this.incrementStat('tracks_played', 1);
    this.incrementStat('total_listening_ms', track.durationMs || 0);

    const trackKey = `${track.title.toLowerCase()}::${track.artist.toLowerCase()}`;
    this.db
      .prepare(`
        INSERT INTO track_play_counts (track_key, title, artist, artwork_url, plays)
        VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(track_key) DO UPDATE SET plays = plays + 1
      `)
      .run(trackKey, track.title, track.artist, track.artworkUrl || SAMURAI_LOGO_URL);
  }

  getHistory(guildId: string, limit = 30): HistoryEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM music_history WHERE guild_id = ? ORDER BY played_at DESC LIMIT ?')
      .all(guildId, limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      guildId: r.guild_id,
      track: JSON.parse(r.track_json),
      playedAt: r.played_at,
    }));
  }

  // Favorites
  getFavorites(guildId: string): FavoriteEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM favorites WHERE guild_id = ? ORDER BY saved_at DESC')
      .all(guildId) as any[];
    return rows.map((r) => ({
      id: r.id,
      guildId: r.guild_id,
      userId: r.user_id,
      track: JSON.parse(r.track_json),
      savedAt: r.saved_at,
    }));
  }

  toggleFavorite(guildId: string, userId: string, track: TrackItem): { favorited: boolean; favorites: FavoriteEntry[] } {
    const existing = this.db
      .prepare('SELECT id FROM favorites WHERE guild_id = ? AND user_id = ? AND track_id = ?')
      .get(guildId, userId, track.id) as any;
    if (existing) {
      this.db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
      return { favorited: false, favorites: this.getFavorites(guildId) };
    }
    this.db
      .prepare('INSERT INTO favorites (id, guild_id, user_id, track_id, track_json, saved_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`fav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, guildId, userId, track.id, JSON.stringify(track), Date.now());
    return { favorited: true, favorites: this.getFavorites(guildId) };
  }

  // Blacklist
  getBlacklist(guildId: string): BlacklistEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM blacklisted_users WHERE guild_id = ? ORDER BY added_at DESC')
      .all(guildId) as any[];
    return rows.map((r) => ({
      guildId: r.guild_id,
      userId: r.user_id,
      username: r.username,
      reason: r.reason,
      addedBy: r.added_by,
      addedAt: r.added_at,
    }));
  }

  isBlacklisted(guildId: string, userId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM blacklisted_users WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId);
    return Boolean(row);
  }

  addBlacklist(entry: BlacklistEntry): BlacklistEntry[] {
    this.db
      .prepare(`
        INSERT INTO blacklisted_users (guild_id, user_id, username, reason, added_by, added_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET reason = excluded.reason, added_at = excluded.added_at
      `)
      .run(entry.guildId, entry.userId, entry.username, entry.reason, entry.addedBy, entry.addedAt);
    return this.getBlacklist(entry.guildId);
  }

  removeBlacklist(guildId: string, userId: string): boolean {
    const res = this.db
      .prepare('DELETE FROM blacklisted_users WHERE guild_id = ? AND user_id = ?')
      .run(guildId, userId);
    return res.changes > 0;
  }

  // Queue persistence
  saveQueueSnapshot(guildId: string, state: unknown) {
    this.db
      .prepare(`
        INSERT INTO guild_queues (guild_id, state_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
      `)
      .run(guildId, JSON.stringify(state), Date.now());
  }

  loadQueueSnapshot<T>(guildId: string): T | null {
    const row = this.db.prepare('SELECT state_json FROM guild_queues WHERE guild_id = ?').get(guildId) as any;
    if (!row) return null;
    try {
      return JSON.parse(row.state_json) as T;
    } catch {
      return null;
    }
  }

  // Stats
  incrementStat(key: string, amount = 1) {
    this.db
      .prepare('INSERT INTO stats_counters (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = value + ?')
      .run(key, amount, amount);
  }

  recordCommandUsage(commandName: string) {
    this.incrementStat('commands_executed', 1);
    this.db
      .prepare('INSERT INTO command_usage (command_name, count) VALUES (?, 1) ON CONFLICT(command_name) DO UPDATE SET count = count + 1')
      .run(commandName);
  }

  getStats(): BotStatsSnapshot {
    const counters = this.db.prepare('SELECT key, value FROM stats_counters').all() as Array<{ key: string; value: number }>;
    const counterMap = Object.fromEntries(counters.map((c) => [c.key, c.value]));
    const topTracks = this.db
      .prepare('SELECT title, artist, artwork_url as artworkUrl, plays FROM track_play_counts ORDER BY plays DESC LIMIT 6')
      .all() as Array<{ title: string; artist: string; artworkUrl: string; plays: number }>;
    const commandBreakdown = this.db
      .prepare('SELECT command_name as name, count FROM command_usage ORDER BY count DESC LIMIT 12')
      .all() as Array<{ name: string; count: number }>;

    return {
      tracksPlayed: counterMap.tracks_played || 0,
      commandsExecuted: counterMap.commands_executed || 0,
      totalListeningMs: counterMap.total_listening_ms || 0,
      topTracks,
      commandBreakdown,
    };
  }
}
