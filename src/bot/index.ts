import dns from 'node:dns/promises';
import net from 'node:net';
import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { Kazagumo } from 'kazagumo';
import { Connectors } from 'shoukaku';
import { loadBotConfig } from './config/botConfig.ts';
import type { ShadowDatabase } from './database/sqlite.ts';
import { buildCommandMap, getSlashCommandPayloads } from './handlers/commandHandler.ts';
import { registerDiscordEvents } from './handlers/eventHandler.ts';
import { buildDiscordPlayerMessage } from './music/discordPlayerEmbed.ts';
import type { GuildMusicBridge } from './music/playerManager.ts';

export interface ShadowBotHandle {
  client: Client;
  kazagumo: Kazagumo;
  startedAt: number;
  lavalinkConnected: boolean;
  shutdown: () => Promise<void>;
}

async function isLavalinkEndpointReachable(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  try {
    await dns.lookup(host);
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

export async function startShadowBot(
  db: ShadowDatabase,
  bridge: GuildMusicBridge
): Promise<ShadowBotHandle | null> {
  const config = loadBotConfig();
  if (!config.discordToken) {
    console.log('[SHADOW MUSIC] DISCORD_BOT_TOKEN not set — running in Studio mode.');
    return null;
  }

  const startedAt = Date.now();
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  let lavalinkConnected = false;
  let announcedStandby = false;
  let nodeAdded = false;

  const kazagumo = new Kazagumo(
    {
      defaultSearchEngine: 'youtube',
      send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
    },
    new Connectors.DiscordJS(client),
    [],
    {
      moveOnDisconnect: false,
      resume: true,
      resumeTimeout: 30,
      reconnectTries: 3,
      restTimeout: 15000,
    }
  );

  kazagumo.shoukaku.on('ready', (name) => {
    lavalinkConnected = true;
    announcedStandby = false;
    console.log(`[SHADOW MUSIC] Lavalink node "${name}" connected.`);
  });

  kazagumo.shoukaku.on('error', (name, error) => {
    lavalinkConnected = false;
    console.warn(`[SHADOW MUSIC] Lavalink node "${name}" notice: ${error.message}`);
  });

  kazagumo.shoukaku.on('close', (name) => {
    lavalinkConnected = false;
    console.warn(`[SHADOW MUSIC] Lavalink node "${name}" closed.`);
  });

  kazagumo.shoukaku.on('disconnect', (name) => {
    lavalinkConnected = false;
    nodeAdded = false;
    try {
      kazagumo.shoukaku.removeNode(name, 'Node disconnected; scheduling reachability probe');
    } catch {
      // Ignore if already removed
    }
  });

  const tryConnectLavalink = async () => {
    if (lavalinkConnected || nodeAdded) return;
    const reachable = await isLavalinkEndpointReachable(config.lavalink.host, config.lavalink.port);
    if (!reachable) {
      if (!announcedStandby) {
        announcedStandby = true;
        console.log(
          `[SHADOW MUSIC] Lavalink "${config.lavalink.url}" is unreachable from this network — running Discord bot in standby until reachable.`
        );
      }
      return;
    }

    nodeAdded = true;
    kazagumo.shoukaku.addNode({
      name: config.lavalink.name,
      url: config.lavalink.url,
      auth: config.lavalink.auth,
      secure: config.lavalink.secure,
    });
  };

  client.once(Events.ClientReady, async (readyClient) => {
    void tryConnectLavalink();
    try {
      const payloads = getSlashCommandPayloads();
      const devGuildId = process.env.DISCORD_DEV_GUILD_ID?.trim();
      if (devGuildId) {
        const guild = await readyClient.guilds.fetch(devGuildId).catch(() => null);
        if (guild) {
          await guild.commands.set(payloads as any);
          console.log(`[SHADOW MUSIC] Synced ${payloads.length} slash commands to guild ${guild.id}.`);
        }
      } else if (readyClient.application) {
        await readyClient.application.commands.set(payloads as any);
        console.log(`[SHADOW MUSIC] Synced ${payloads.length} global slash commands.`);
      }
    } catch (err: any) {
      console.warn('[SHADOW MUSIC] Slash command auto-sync warning:', err?.message || err);
    }
  });

  // Fast initial checks for Railway multi-container cold boot (10s), then steady 30s probe
  const retryTimer = setInterval(() => {
    if (!lavalinkConnected && !nodeAdded && client.isReady()) {
      void tryConnectLavalink();
    }
  }, 15000);
  retryTimer.unref();

  kazagumo.on('playerStart', async (player) => {
    const guild = client.guilds.cache.get(player.guildId);
    bridge.syncFromKazagumoPlayer(player, guild?.name || 'Discord Server');
    const state = bridge.getPlayerState(player.guildId);
    if (state.currentTrack) {
      db.recordHistory(player.guildId, state.currentTrack);
    }

    if (player.textId) {
      const channel = client.channels.cache.get(player.textId) as TextChannel | undefined;
      if (channel?.isTextBased()) {
        const payload = buildDiscordPlayerMessage(state, client.user?.displayAvatarURL());
        await channel.send(payload).catch(() => {});
      }
    }
  });

  kazagumo.on('playerEnd', (player) => {
    const guild = client.guilds.cache.get(player.guildId);
    bridge.syncFromKazagumoPlayer(player, guild?.name || 'Discord Server');
  });

  kazagumo.on('playerDestroy', async (player) => {
    await bridge.stop(player.guildId, true);
  });

  kazagumo.on('playerException', (player, data) => {
    console.warn(`[SHADOW MUSIC] Track exception in guild ${player.guildId}:`, data.exception?.message || 'Unknown error');
    player.skip();
  });

  kazagumo.on('playerStuck', (player) => {
    console.warn(`[SHADOW MUSIC] Track stuck in guild ${player.guildId}; skipping.`);
    player.skip();
  });

  kazagumo.on('playerEmpty', async (player) => {
    const guild = client.guilds.cache.get(player.guildId);
    const settings = db.getGuildSettings(player.guildId, guild?.name);
    if (settings.autoplay && player.queue.previous.length > 0) {
      const last = player.queue.previous[0];
      const res = await kazagumo.search(`${last.author} ${last.title}`, {
        requester: { id: 'autoplay', username: 'Autoplay' },
      });
      const rec = res.tracks.find((t) => t.identifier !== last.identifier);
      if (rec) {
        player.queue.add(rec);
        await player.play();
        return;
      }
    }
    bridge.syncFromKazagumoPlayer(player, guild?.name || 'Discord Server');
    if (!settings.mode247) {
      bridge.scheduleInactivityDisconnect(player.guildId);
    }
  });

  bridge.attachKazagumo(kazagumo);

  const commands = buildCommandMap();
  registerDiscordEvents(
    {
      client,
      kazagumo,
      db,
      bridge,
      config,
      startedAt,
    },
    commands
  );

  await client.login(config.discordToken);

  return {
    client,
    kazagumo,
    startedAt,
    get lavalinkConnected() {
      return lavalinkConnected;
    },
    shutdown: async () => {
      clearInterval(retryTimer);
      await client.destroy();
    },
  };
}
