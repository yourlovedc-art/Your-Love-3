import { ButtonInteraction, GuildMember, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import type { ShadowDatabase } from '../database/sqlite.ts';
import { buildDiscordPlayerMessage } from '../music/discordPlayerEmbed.ts';
import type { GuildMusicBridge } from '../music/playerManager.ts';
import { formatDuration } from '../utils/formatters.ts';
import { safeDeferReply, safeDeferUpdate, safeRespond } from '../utils/interactions.ts';
import { checkDjPermission } from '../utils/permissions.ts';

export async function handlePlayerButtonInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  bridge: GuildMusicBridge,
  db: ShadowDatabase,
  samuraiAvatarUrl?: string
) {
  if (!interaction.guildId || !interaction.guild) return;

  const member = interaction.member as GuildMember | null;
  if (!member?.voice?.channelId) {
    await safeRespond(interaction, {
      content: 'Join a voice channel to interact with the Shadow Music player.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const botVoiceId = interaction.guild.members.me?.voice?.channelId;
  if (botVoiceId && member.voice.channelId !== botVoiceId) {
    await safeRespond(interaction, {
      content: `Join <#${botVoiceId}> to control this player.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId;

  if (interaction.customId === 'sm_queue') {
    const acked = await safeDeferReply(interaction, true);
    if (!acked) return;
    db.recordCommandUsage(`button:${interaction.customId}`);
    const state = bridge.getPlayerState(guildId);
    const lines = state.queue.slice(0, 10).map(
      (t, i) => `\`${i + 1}.\` **${t.title}** — ${t.artist} \`[${formatDuration(t.durationMs)}]\``
    );
    await safeRespond(interaction, {
      content:
        lines.length > 0
          ? `**Upcoming Queue (${state.queue.length} tracks)**\n${lines.join('\n')}`
          : 'The server queue is currently empty.',
    });
    return;
  }

  const djCheck = checkDjPermission(member, db, guildId);
  if (!djCheck.allowed) {
    await safeRespond(interaction, {
      content: djCheck.reason || 'DJ permission required.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const acked = await safeDeferUpdate(interaction);
  if (!acked) return;

  db.recordCommandUsage(`button:${interaction.customId}`);

  if (interaction.isStringSelectMenu() && interaction.customId === 'sm_queue_jump') {
    const idx = Number(interaction.values[0]);
    const state = await bridge.jumpToQueueIndex(guildId, idx);
    await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
    return;
  }

  switch (interaction.customId) {
    case 'sm_previous': {
      const state = await bridge.previous(guildId);
      await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
      break;
    }
    case 'sm_toggle_pause': {
      const state = await bridge.togglePause(guildId);
      await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
      break;
    }
    case 'sm_skip': {
      const state = await bridge.skip(guildId);
      await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
      break;
    }
    case 'sm_stop': {
      const state = await bridge.stop(guildId, false);
      await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
      break;
    }
    case 'sm_loop': {
      const state = bridge.cycleLoop(guildId);
      await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
      break;
    }
    case 'sm_shuffle': {
      const state = bridge.toggleShuffle(guildId);
      await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
      break;
    }
    case 'sm_vol_down': {
      const curr = bridge.getPlayerState(guildId);
      const state = await bridge.setVolume(guildId, curr.volume - 10);
      await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
      break;
    }
    case 'sm_vol_up': {
      const curr = bridge.getPlayerState(guildId);
      const state = await bridge.setVolume(guildId, curr.volume + 10);
      await safeRespond(interaction, buildDiscordPlayerMessage(state, samuraiAvatarUrl));
      break;
    }
    default:
      await safeRespond(interaction, {
        content: 'Unknown player control.',
        flags: MessageFlags.Ephemeral,
      });
  }
}
