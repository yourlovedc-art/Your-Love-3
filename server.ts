import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { loadBotConfig } from './src/bot/config/botConfig.ts';
import { BUILTIN_CATALOG, SAMURAI_LOGO_URL, ShadowDatabase } from './src/bot/database/sqlite.ts';
import { startShadowBot, type ShadowBotHandle } from './src/bot/index.ts';
import { GuildMusicBridge } from './src/bot/music/playerManager.ts';
import { BOT_COMMANDS_CATALOG } from './src/bot/utils/commandRegistry.ts';
import { parseTimeToMs } from './src/bot/utils/formatters.ts';
import type {
  BotRuntimeStatus,
  FullDashboardState,
  GuildSettings,
  LoopMode,
  TrackItem,
} from './src/shared/types.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const serverStartedAt = Date.now();
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Ensure assets/samurai-logo.jpg exists as documented
const GENERATED_SAMURAI = path.resolve(process.cwd(), 'src/assets/images/samurai_logo_1795268379491.jpg');
const ASSETS_DIR = path.resolve(process.cwd(), 'assets');
const ASSETS_LOGO = path.join(ASSETS_DIR, 'samurai-logo.jpg');
if (fs.existsSync(GENERATED_SAMURAI) && !fs.existsSync(ASSETS_LOGO)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.copyFileSync(GENERATED_SAMURAI, ASSETS_LOGO);
}

const db = new ShadowDatabase();
const bridge = new GuildMusicBridge(db);
const config = loadBotConfig();
let botHandle: ShadowBotHandle | null = null;

function getRuntimeStatus(): BotRuntimeStatus {
  const discordConnected = Boolean(botHandle?.client?.isReady());
  return {
    discordConnected,
    botUsername: botHandle?.client?.user?.username || 'Shadow Music',
    botTag: botHandle?.client?.user?.tag || 'Shadow Music#0001',
    botAvatar: botHandle?.client?.user?.displayAvatarURL() || SAMURAI_LOGO_URL,
    clientId: botHandle?.client?.user?.id || config.clientId || '',
    lavalinkConnected: Boolean(botHandle?.lavalinkConnected),
    lavalinkNodeName: config.lavalink.name,
    pingMs: discordConnected ? Math.max(0, Math.round(botHandle!.client.ws.ping)) : 12,
    uptimeMs: Date.now() - serverStartedAt,
    guildCount: discordConnected ? botHandle!.client.guilds.cache.size : db.getAllGuilds().length,
    activePlayers: bridge.getActivePlayersCount(),
  };
}

function buildFullState(guildId = 'dojo-primary'): FullDashboardState {
  const guilds = db.getAllGuilds();
  const targetGuild = guilds.find((g) => g.guildId === guildId) ? guildId : guilds[0]?.guildId || 'dojo-primary';
  return {
    status: getRuntimeStatus(),
    guilds,
    activeGuildId: targetGuild,
    player: bridge.getPlayerState(targetGuild),
    playlists: db.getPlaylists(targetGuild),
    history: db.getHistory(targetGuild, 30),
    favorites: db.getFavorites(targetGuild),
    blacklist: db.getBlacklist(targetGuild),
    stats: db.getStats(),
    catalog: BUILTIN_CATALOG,
  };
}

async function bootstrap() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '20mb' }));

  // Serve uploaded audio safely from data/uploads
  app.get('/uploads/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const resolved = path.resolve(UPLOADS_DIR, safeName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }
    res.sendFile(resolved);
  });

  // WebSocket setup on same HTTP server
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clientGuildMap = new Map<WebSocket, string>();

  function broadcast(type: string, payload: unknown, filterGuildId?: string) {
    const message = JSON.stringify({ type, payload });
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (filterGuildId) {
        const subGuild = clientGuildMap.get(ws) || 'dojo-primary';
        if (subGuild !== filterGuildId) continue;
      }
      ws.send(message);
    }
  }

  bridge.on('player:update', (state) => {
    broadcast('PLAYER_UPDATE', state, state.guildId);
    broadcast('STATS_UPDATE', db.getStats());
  });

  bridge.on('player:tick', ({ guildId, positionMs }) => {
    broadcast('PLAYER_TICK', { guildId, positionMs }, guildId);
  });

  wss.on('connection', (ws) => {
    clientGuildMap.set(ws, 'dojo-primary');
    ws.send(JSON.stringify({ type: 'STATE_SYNC', payload: buildFullState('dojo-primary') }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'SELECT_GUILD' && typeof msg.guildId === 'string') {
          clientGuildMap.set(ws, msg.guildId);
          ws.send(JSON.stringify({ type: 'STATE_SYNC', payload: buildFullState(msg.guildId) }));
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      clientGuildMap.delete(ws);
    });
  });

  // ---------------- Health & Bot Control API ----------------
  app.get('/health', (_req, res) => {
    res.json({ ok: true, ...getRuntimeStatus() });
  });

  app.get('/api/state', (req, res) => {
    const guildId = typeof req.query.guildId === 'string' ? req.query.guildId : 'dojo-primary';
    res.json(buildFullState(guildId));
  });

  app.get('/api/commands', (_req, res) => {
    res.json({ commands: BOT_COMMANDS_CATALOG });
  });

  app.post('/api/guilds', (req, res) => {
    const { guildName } = req.body as { guildName?: string };
    if (!guildName || !guildName.trim()) {
      res.status(400).json({ error: 'Server name is required.' });
      return;
    }
    const id = `guild_${Date.now()}`;
    const created = db.getGuildSettings(id, guildName.trim());
    broadcast('GUILDS_UPDATE', db.getAllGuilds());
    res.json({ guild: created, guilds: db.getAllGuilds() });
  });

  // Player controls
  app.post('/api/player/action', async (req, res) => {
    const { guildId = 'dojo-primary', action, value } = req.body as {
      guildId?: string;
      action?: string;
      value?: unknown;
    };

    try {
      let state = bridge.getPlayerState(guildId);
      switch (action) {
        case 'play':
          state = await bridge.playCurrentOrFirst(guildId);
          break;
        case 'togglePause':
          state = await bridge.togglePause(guildId);
          break;
        case 'skip':
          state = await bridge.skip(guildId);
          break;
        case 'previous':
          state = await bridge.previous(guildId);
          break;
        case 'stop':
          state = await bridge.stop(guildId, false);
          break;
        case 'leave':
          state = await bridge.stop(guildId, true);
          break;
        case 'volume':
          if (typeof value === 'number') {
            state = await bridge.setVolume(guildId, value);
          }
          break;
        case 'seek':
          if (typeof value === 'number') {
            state = await bridge.seek(guildId, value);
          }
          break;
        case 'loop':
          state = bridge.cycleLoop(guildId, typeof value === 'string' ? (value as LoopMode) : undefined);
          break;
        case 'shuffle':
          state = bridge.toggleShuffle(guildId);
          break;
        case 'autoplay':
          state = bridge.toggleAutoplay(guildId, typeof value === 'boolean' ? value : undefined);
          break;
        case 'clear':
          state = bridge.clearQueue(guildId);
          break;
        case 'jump':
          if (typeof value === 'number') {
            state = await bridge.jumpToQueueIndex(guildId, value);
          }
          break;
        default:
          res.status(400).json({ error: `Unsupported player action: ${action}` });
          return;
      }

      db.recordCommandUsage(`player:${action}`);
      res.json({ player: state, history: db.getHistory(guildId, 30), stats: db.getStats() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Player action failed' });
    }
  });

  // Queue operations
  app.post('/api/queue/add', async (req, res) => {
    const { guildId = 'dojo-primary', track, playNow = false } = req.body as {
      guildId?: string;
      track?: Partial<TrackItem>;
      playNow?: boolean;
    };

    if (!track || !track.title) {
      res.status(400).json({ error: 'Track title is required.' });
      return;
    }

    const fullTrack: TrackItem = {
      id: track.id || `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: String(track.title).slice(0, 120),
      artist: String(track.artist || 'Shadow Dojo').slice(0, 80),
      durationMs: Number(track.durationMs) || 180000,
      artworkUrl: track.artworkUrl || SAMURAI_LOGO_URL,
      uri: track.uri || 'synth://custom',
      source: track.source || 'synth',
      synthPreset: track.synthPreset || 'kamakura',
      audioUrl: track.audioUrl,
      requestedBy: track.requestedBy || { id: 'bot-console', username: 'Bot Operator' },
      addedAt: Date.now(),
    };

    if (botHandle?.lavalinkConnected && fullTrack.source === 'lavalink') {
      const kazaPlayer = botHandle.kazagumo.getPlayer(guildId);
      if (kazaPlayer) {
        const search = await botHandle.kazagumo.search(fullTrack.uri || fullTrack.title, {
          requester: fullTrack.requestedBy,
        });
        if (search.tracks[0]) {
          kazaPlayer.queue.add(search.tracks[0]);
          if (!kazaPlayer.playing && !kazaPlayer.paused) await kazaPlayer.play();
        }
      }
    }

    const state = await bridge.enqueueTrack(guildId, fullTrack, playNow);
    db.recordCommandUsage('play');
    res.json({ player: state, history: db.getHistory(guildId, 30), stats: db.getStats() });
  });

  app.post('/api/queue/remove', (req, res) => {
    const { guildId = 'dojo-primary', index } = req.body as { guildId?: string; index?: number };
    if (typeof index !== 'number') {
      res.status(400).json({ error: 'Numeric index required.' });
      return;
    }
    const removed = bridge.removeQueueItem(guildId, index);
    if (!removed) {
      res.status(404).json({ error: 'Queue item not found.' });
      return;
    }
    db.recordCommandUsage('remove');
    res.json({ player: bridge.getPlayerState(guildId) });
  });

  app.post('/api/queue/move', (req, res) => {
    const { guildId = 'dojo-primary', from, to } = req.body as { guildId?: string; from?: number; to?: number };
    if (typeof from !== 'number' || typeof to !== 'number') {
      res.status(400).json({ error: 'from and to indices required.' });
      return;
    }
    const ok = bridge.moveQueueItem(guildId, from, to);
    if (!ok) {
      res.status(400).json({ error: 'Invalid queue indices.' });
      return;
    }
    db.recordCommandUsage('move');
    res.json({ player: bridge.getPlayerState(guildId) });
  });

  // Real audio file upload (MP3 / WAV / OGG / M4A / FLAC / WebM)
  app.post('/api/audio/upload', async (req, res) => {
    const { guildId = 'dojo-primary', fileName, dataBase64, title, artist, durationMs } = req.body as {
      guildId?: string;
      fileName?: string;
      dataBase64?: string;
      title?: string;
      artist?: string;
      durationMs?: number;
    };

    if (!fileName || !dataBase64) {
      res.status(400).json({ error: 'Missing fileName or audio data.' });
      return;
    }

    const ext = path.extname(fileName).toLowerCase();
    const allowedExts = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.flac']);
    if (!allowedExts.has(ext)) {
      res.status(400).json({ error: 'Unsupported audio format. Use MP3, WAV, OGG, M4A, FLAC, or WebM.' });
      return;
    }

    const base64Clean = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
    const buffer = Buffer.from(base64Clean, 'base64');
    if (buffer.length === 0 || buffer.length > 15 * 1024 * 1024) {
      res.status(400).json({ error: 'Audio file must be between 1 byte and 15 MB.' });
      return;
    }

    const safeFileName = `track_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const destPath = path.resolve(UPLOADS_DIR, safeFileName);
    if (!destPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }

    fs.writeFileSync(destPath, buffer);
    const cleanTitle = (title || path.basename(fileName, ext)).slice(0, 100);

    const track: TrackItem = {
      id: `upload_${Date.now()}`,
      title: cleanTitle,
      artist: (artist || 'Uploaded Audio').slice(0, 80),
      durationMs: Number(durationMs) || 180000,
      artworkUrl: SAMURAI_LOGO_URL,
      uri: `/uploads/${safeFileName}`,
      source: 'upload',
      audioUrl: `/uploads/${safeFileName}`,
      requestedBy: { id: 'bot-console', username: 'Bot Operator' },
      addedAt: Date.now(),
    };

    const state = await bridge.enqueueTrack(guildId, track, true);
    db.recordCommandUsage('play');
    res.json({ track, player: state, history: db.getHistory(guildId, 30) });
  });

  // Playlists
  app.post('/api/playlists', (req, res) => {
    const { guildId = 'dojo-primary', name, description = '', tracks = [] } = req.body as {
      guildId?: string;
      name?: string;
      description?: string;
      tracks?: TrackItem[];
    };
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Playlist name is required.' });
      return;
    }
    try {
      const playlist = db.createPlaylist(
        guildId,
        'bot-console',
        'Bot Operator',
        name,
        description,
        tracks
      );
      const all = db.getPlaylists(guildId);
      broadcast('PLAYLISTS_UPDATE', { guildId, playlists: all }, guildId);
      db.recordCommandUsage('playlist create');
      res.json({ playlist, playlists: all });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to create playlist.' });
    }
  });

  app.delete('/api/playlists/:name', (req, res) => {
    const guildId = typeof req.query.guildId === 'string' ? req.query.guildId : 'dojo-primary';
    const deleted = db.deletePlaylist(guildId, req.params.name);
    if (!deleted) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }
    const all = db.getPlaylists(guildId);
    broadcast('PLAYLISTS_UPDATE', { guildId, playlists: all }, guildId);
    db.recordCommandUsage('playlist delete');
    res.json({ playlists: all });
  });

  app.post('/api/playlists/:name/tracks', (req, res) => {
    const { guildId = 'dojo-primary', track } = req.body as { guildId?: string; track?: TrackItem };
    if (!track) {
      res.status(400).json({ error: 'Track object required.' });
      return;
    }
    try {
      const playlist = db.addTrackToPlaylist(guildId, req.params.name, track);
      const all = db.getPlaylists(guildId);
      broadcast('PLAYLISTS_UPDATE', { guildId, playlists: all }, guildId);
      db.recordCommandUsage('playlist add');
      res.json({ playlist, playlists: all });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to add track.' });
    }
  });

  app.delete('/api/playlists/:name/tracks/:index', (req, res) => {
    const guildId = typeof req.query.guildId === 'string' ? req.query.guildId : 'dojo-primary';
    const idx = Number(req.params.index);
    try {
      const playlist = db.removeTrackFromPlaylist(guildId, req.params.name, idx);
      const all = db.getPlaylists(guildId);
      broadcast('PLAYLISTS_UPDATE', { guildId, playlists: all }, guildId);
      db.recordCommandUsage('playlist remove');
      res.json({ playlist, playlists: all });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to remove track.' });
    }
  });

  app.post('/api/playlists/:name/play', async (req, res) => {
    const { guildId = 'dojo-primary', replace = true } = req.body as { guildId?: string; replace?: boolean };
    const pl = db.getPlaylistByName(guildId, req.params.name);
    if (!pl || pl.tracks.length === 0) {
      res.status(404).json({ error: 'Playlist is empty or not found.' });
      return;
    }
    const state = await bridge.enqueueMany(guildId, pl.tracks, replace);
    db.recordCommandUsage('playlist play');
    res.json({ player: state, history: db.getHistory(guildId, 30) });
  });

  // Favorites
  app.post('/api/favorites/toggle', (req, res) => {
    const { guildId = 'dojo-primary', track } = req.body as { guildId?: string; track?: TrackItem };
    if (!track) {
      res.status(400).json({ error: 'Track required.' });
      return;
    }
    const result = db.toggleFavorite(guildId, 'bot-console', track);
    broadcast('FAVORITES_UPDATE', { guildId, favorites: result.favorites }, guildId);
    res.json(result);
  });

  // Settings & Blacklist
  app.put('/api/settings/:guildId', (req, res) => {
    const guildId = req.params.guildId;
    const current = db.getGuildSettings(guildId);
    const body = req.body as Partial<GuildSettings>;
    const updated = db.upsertGuildSettings({
      ...current,
      ...body,
      guildId,
      updatedAt: Date.now(),
    });
    bridge.applyGuildSettingsUpdate(updated);
    broadcast('SETTINGS_UPDATE', { guildId, settings: updated, guilds: db.getAllGuilds() });
    res.json({ settings: updated, guilds: db.getAllGuilds() });
  });

  app.post('/api/settings/:guildId/reset', (req, res) => {
    const reset = db.resetGuildSettings(req.params.guildId);
    bridge.applyGuildSettingsUpdate(reset);
    db.recordCommandUsage('reset');
    broadcast('SETTINGS_UPDATE', { guildId: req.params.guildId, settings: reset, guilds: db.getAllGuilds() });
    res.json({ settings: reset, guilds: db.getAllGuilds() });
  });

  app.post('/api/blacklist', (req, res) => {
    const { guildId = 'dojo-primary', userId, username, reason = 'Restricted by admin' } = req.body as {
      guildId?: string;
      userId?: string;
      username?: string;
      reason?: string;
    };
    if (!userId || !username) {
      res.status(400).json({ error: 'userId and username are required.' });
      return;
    }
    const list = db.addBlacklist({
      guildId,
      userId: userId.trim(),
      username: username.trim(),
      reason: reason.trim(),
      addedBy: 'Bot Admin',
      addedAt: Date.now(),
    });
    db.recordCommandUsage('blacklist');
    broadcast('BLACKLIST_UPDATE', { guildId, blacklist: list }, guildId);
    res.json({ blacklist: list });
  });

  app.delete('/api/blacklist/:userId', (req, res) => {
    const guildId = typeof req.query.guildId === 'string' ? req.query.guildId : 'dojo-primary';
    db.removeBlacklist(guildId, req.params.userId);
    const list = db.getBlacklist(guildId);
    db.recordCommandUsage('unblacklist');
    broadcast('BLACKLIST_UPDATE', { guildId, blacklist: list }, guildId);
    res.json({ blacklist: list });
  });

  // Execute command from Command Console
  app.post('/api/commands/execute', async (req, res) => {
    const { guildId = 'dojo-primary', rawCommand = '' } = req.body as { guildId?: string; rawCommand?: string };
    const clean = rawCommand.trim();
    if (!clean) {
      res.status(400).json({ error: 'Command string is required.' });
      return;
    }

    const parts = clean.replace(/^[/!]/, '').split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const argStr = parts.slice(1).join(' ');

    try {
      let message = '';
      if (cmd === 'play') {
        const match =
          BUILTIN_CATALOG.find((t) => t.title.toLowerCase().includes(argStr.toLowerCase())) ||
          BUILTIN_CATALOG[0];
        const track: TrackItem = {
          ...match,
          id: `${match.id}_${Date.now()}`,
          title: argStr
            ? BUILTIN_CATALOG.some((t) => t.title.toLowerCase().includes(argStr.toLowerCase()))
              ? match.title
              : argStr
            : match.title,
          requestedBy: { id: 'console', username: 'Command Console' },
          addedAt: Date.now(),
        };
        await bridge.enqueueTrack(guildId, track, false);
        message = `Queued "${track.title}" by ${track.artist}.`;
      } else if (cmd === 'pause') {
        await bridge.togglePause(guildId, true);
        message = 'Playback paused.';
      } else if (cmd === 'resume') {
        await bridge.togglePause(guildId, false);
        message = 'Playback resumed.';
      } else if (cmd === 'skip') {
        const s = await bridge.skip(guildId);
        message = s.currentTrack ? `Skipped to "${s.currentTrack.title}".` : 'Skipped. Queue is empty.';
      } else if (cmd === 'previous') {
        const s = await bridge.previous(guildId);
        message = s.currentTrack ? `Returned to "${s.currentTrack.title}".` : 'No previous track available.';
      } else if (cmd === 'stop') {
        await bridge.stop(guildId, false);
        message = 'Stopped playback and cleared queue.';
      } else if (cmd === 'volume') {
        const lvl = Number(parts[1]);
        if (Number.isNaN(lvl) || lvl < 1 || lvl > 100) {
          res.status(400).json({ error: 'Volume must be between 1 and 100.' });
          return;
        }
        await bridge.setVolume(guildId, lvl);
        message = `Volume set to ${lvl}%.`;
      } else if (cmd === 'seek') {
        const ms = parseTimeToMs(parts[1] || '');
        if (ms === null) {
          res.status(400).json({ error: 'Invalid time format. Use e.g. /seek 1:30 or /seek 45s' });
          return;
        }
        await bridge.seek(guildId, ms);
        message = `Seeked to ${parts[1]}.`;
      } else if (cmd === 'shuffle') {
        const s = bridge.toggleShuffle(guildId);
        message = `Queue shuffled (${s.queue.length} upcoming tracks).`;
      } else if (cmd === 'loop') {
        const mode = (parts[1]?.toLowerCase() as LoopMode) || undefined;
        const s = bridge.cycleLoop(guildId, mode && ['off', 'song', 'queue'].includes(mode) ? mode : undefined);
        message = `Loop mode set to ${s.loop.toUpperCase()}.`;
      } else if (cmd === 'clear') {
        bridge.clearQueue(guildId);
        message = 'Cleared upcoming queue.';
      } else if (cmd === '247') {
        const curr = db.getGuildSettings(guildId);
        const upd = db.upsertGuildSettings({ ...curr, mode247: !curr.mode247 });
        bridge.applyGuildSettingsUpdate(upd);
        message = `24/7 mode is now ${upd.mode247 ? 'ENABLED' : 'DISABLED'}.`;
      } else if (cmd === 'ping') {
        const st = getRuntimeStatus();
        message = `Gateway Ping: ${st.pingMs}ms · Lavalink: ${st.lavalinkConnected ? 'Connected' : 'Standby'}`;
      } else {
        message = `Recorded command "/${cmd}". Voice execution runs inside Discord via DISCORD_BOT_TOKEN.`;
      }

      db.recordCommandUsage(cmd);
      res.json({ ok: true, message, state: buildFullState(guildId) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Command failed.' });
    }
  });

  // Frontend Vite middleware (dev) or static dist (prod)
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`[SHADOW MUSIC] Bot & Console server listening on http://0.0.0.0:${PORT}`);
    try {
      botHandle = await startShadowBot(db, bridge);
    } catch (err: any) {
      console.error('[SHADOW MUSIC] Discord bot startup notice:', err?.message || err);
    }
  });

  const gracefulShutdown = async () => {
    bridge.stopTicker();
    if (botHandle) await botHandle.shutdown();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

bootstrap().catch((err) => {
  console.error('[SHADOW MUSIC] Fatal bootstrap error:', err);
  process.exit(1);
});
