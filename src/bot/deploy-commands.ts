import { REST, Routes } from 'discord.js';
import { loadBotConfig } from './config/botConfig.ts';
import { getSlashCommandPayloads } from './handlers/commandHandler.ts';

function deriveClientIdFromToken(token: string): string {
  try {
    const firstPart = token.split('.')[0];
    if (!firstPart) return '';
    const decoded = Buffer.from(firstPart, 'base64url').toString('utf8').trim();
    return /^\d{17,21}$/.test(decoded) ? decoded : '';
  } catch {
    return '';
  }
}

async function deploy() {
  const config = loadBotConfig();
  if (!config.discordToken) {
    console.error('Missing DISCORD_BOT_TOKEN in environment.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  let clientId = config.clientId || deriveClientIdFromToken(config.discordToken);
  if (!clientId) {
    const me = (await rest.get(Routes.user())) as { id?: string };
    clientId = me?.id || '';
  }

  if (!clientId) {
    console.error('Could not determine DISCORD_CLIENT_ID from env or bot token.');
    process.exit(1);
  }

  const body = getSlashCommandPayloads();
  const guildId = process.env.DISCORD_DEV_GUILD_ID?.trim();

  console.log(`[SHADOW MUSIC] Registering ${body.length} slash commands for client ${clientId}...`);
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`[SHADOW MUSIC] Registered ${body.length} guild commands for ${guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`[SHADOW MUSIC] Registered ${body.length} global application commands.`);
  }
}

deploy().catch((err) => {
  console.error('[SHADOW MUSIC] Failed to deploy commands:', err);
  process.exit(1);
});

