import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface BotConfig {
  discordToken: string;
  clientId: string;
  supportInvite: string;
  appUrl: string;
  lavalink: {
    name: string;
    host: string;
    port: number;
    url: string;
    auth: string;
    secure: boolean;
  };
  samuraiLogoPath: string;
  embedColor: number;
}

function parseLavalinkEndpoint() {
  const rawHostInput = (process.env.LAVALINK_URL || process.env.LAVALINK_HOST || '127.0.0.1').trim();
  const explicitSecure = process.env.LAVALINK_SECURE;
  const explicitPort = process.env.LAVALINK_PORT ? Number(process.env.LAVALINK_PORT) : undefined;

  let secure = explicitSecure === 'true';
  let hostPart = rawHostInput;

  if (/^(https|wss):\/\//i.test(hostPart)) {
    if (explicitSecure === undefined || explicitSecure === '') {
      secure = true;
    }
    hostPart = hostPart.replace(/^(https|wss):\/\//i, '');
  } else if (/^(http|ws):\/\//i.test(hostPart)) {
    hostPart = hostPart.replace(/^(http|ws):\/\//i, '');
  }

  hostPart = hostPart.split('/')[0];

  let host = hostPart;
  let port = explicitPort && !Number.isNaN(explicitPort) ? explicitPort : secure ? 443 : 2333;

  if (hostPart.includes(':')) {
    const [h, p] = hostPart.split(':');
    host = h;
    const parsedPort = Number(p);
    if (!Number.isNaN(parsedPort) && parsedPort > 0) {
      port = parsedPort;
    }
  }

  return {
    name: (process.env.LAVALINK_NAME || 'Shadow-Node-01').trim(),
    host,
    port,
    url: `${host}:${port}`,
    auth: (process.env.LAVALINK_PASSWORD || 'youshallnotpass').trim(),
    secure,
  };
}

export function loadBotConfig(): BotConfig {
  return {
    discordToken: (process.env.DISCORD_BOT_TOKEN || '').trim(),
    clientId: (process.env.DISCORD_CLIENT_ID || '').trim(),
    supportInvite: (process.env.DISCORD_SUPPORT_INVITE || 'https://discord.gg/shadowmusic').trim(),
    appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
    lavalink: parseLavalinkEndpoint(),
    samuraiLogoPath: path.resolve(process.cwd(), 'src/assets/images/samurai_logo_1795268379491.jpg'),
    embedColor: 0x18181b, // Charcoal obsidian monochrome
  };
}
