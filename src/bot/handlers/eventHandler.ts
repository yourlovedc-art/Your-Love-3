import { Events, GuildMember, Interaction, MessageFlags } from 'discord.js';
import { handlePlayerButtonInteraction } from '../buttons/playerButtons.ts';
import type { BotContext, SlashCommandModule } from '../commands/types.ts';
import { buildDiscordPlayerMessage } from '../music/discordPlayerEmbed.ts';
import { formatDuration } from '../utils/formatters.ts';
import {
  isUnknownOrAckedInteractionError,
  resolveSearchPick,
  safeDeferUpdate,
  safeRespond,
} from '../utils/interactions.ts';

export function registerDiscordEvents(
  ctx: BotContext,
  commands: Map<string, SlashCommandModule>
) {
  const { client, db, bridge, kazagumo } = ctx;

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`[SHADOW MUSIC] Discord bot online as ${readyClient.user.tag}`);
    readyClient.user.setPresence({
      activities: [{ name: 'Where Silence Meets Sound.' }],
      status: 'online',
    });

    for (const guild of readyClient.guilds.cache.values()) {
      db.getGuildSettings(guild.id, guild.name);
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    db.getGuildSettings(guild.id, guild.name);
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);
        if (!command) {
          await safeRespond(interaction, {
            content: `Command \`/${interaction.commandName}\` is no longer registered.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await command.execute(interaction, ctx);
        db.recordCommandUsage(interaction.commandName);
        return;
      }

      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.isStringSelectMenu() && interaction.customId === 'sm_search_pick') {
          const member = interaction.member as GuildMember | null;
          if (!member?.voice?.channelId || !interaction.guildId) {
            await safeRespond(interaction, {
              content: 'Join a voice channel first.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const acked = await safeDeferUpdate(interaction);
          if (!acked) return;

          if (!kazagumo.shoukaku.getIdealNode()) {
            await safeRespond(interaction, {
              content: `Lavalink node \`${ctx.config.lavalink.url}\` is currently offline or unreachable.`,
              components: [],
            });
            return;
          }

          const uri = resolveSearchPick(interaction.values[0]);
          const settings = db.getGuildSettings(interaction.guildId, interaction.guild?.name);
          try {
            const player = await kazagumo.createPlayer({
              guildId: interaction.guildId,
              textId: interaction.channelId,
              voiceId: member.voice.channelId,
              volume: settings.defaultVolume,
            });
            const res = await kazagumo.search(uri, {
              requester: {
                id: interaction.user.id,
                username: interaction.user.username,
                avatarUrl: interaction.user.displayAvatarURL(),
              },
            });
            if (res.tracks[0]) {
              player.queue.add(res.tracks[0]);
              if (!player.playing && !player.paused) await player.play();
              bridge.syncFromKazagumoPlayer(player, interaction.guild?.name || 'Discord Server');
              await safeRespond(interaction, {
                content: `Queued **${res.tracks[0].title}** (${formatDuration(res.tracks[0].length || 0)}).`,
                components: [],
              });
            } else {
              await safeRespond(interaction, {
                content: 'Track could not be resolved.',
                components: [],
              });
            }
          } catch (err: any) {
            await safeRespond(interaction, {
              content: `Playback error: ${err?.message || 'Lavalink node unavailable.'}`,
              components: [],
            });
          }
          return;
        }

        await handlePlayerButtonInteraction(
          interaction,
          bridge,
          db,
          client.user?.displayAvatarURL()
        );
      }
    } catch (err: any) {
      if (isUnknownOrAckedInteractionError(err)) {
        console.warn(`[SHADOW MUSIC] Interaction ${interaction.id} expired or already acknowledged (${err?.code ?? err?.rawError?.code}).`);
        return;
      }
      console.error('[SHADOW MUSIC] Interaction error:', err);
      if (interaction.isRepliable()) {
        await safeRespond(interaction, {
          content: 'An unexpected error occurred executing this action.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const guild = oldState.guild || newState.guild;
    if (!guild) return;
    const botMember = guild.members.me;
    const botVoiceChannel = botMember?.voice?.channel;
    if (!botVoiceChannel) return;

    const settings = db.getGuildSettings(guild.id, guild.name);
    if (settings.mode247) return;

    const humanCount = botVoiceChannel.members.filter((m) => !m.user.bot).size;
    if (humanCount === 0) {
      bridge.scheduleInactivityDisconnect(guild.id);
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guildId || !message.guild) return;
    const settings = db.getGuildSettings(message.guildId, message.guild.name);
    if (!message.content.startsWith(settings.prefix)) return;

    const args = message.content.slice(settings.prefix.length).trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase();
    if (!cmd) return;

    if (db.isBlacklisted(message.guildId, message.author.id)) {
      await message.reply('You are blacklisted from using Shadow Music in this server.');
      return;
    }

    db.recordCommandUsage(`prefix:${cmd}`);

    if (cmd === 'ping') {
      await message.reply(`Gateway Ping: **${Math.max(0, Math.round(client.ws.ping))}ms**`);
    } else if (cmd === 'nowplaying' || cmd === 'np') {
      const state = bridge.getPlayerState(message.guildId, message.guild.name);
      await message.reply(buildDiscordPlayerMessage(state, client.user?.displayAvatarURL()));
    } else if (cmd === 'skip' || cmd === 's') {
      await bridge.skip(message.guildId);
      await message.reply('Skipped current track.');
    } else if (cmd === 'pause') {
      await bridge.togglePause(message.guildId, true);
      await message.reply('Playback paused.');
    } else if (cmd === 'resume') {
      await bridge.togglePause(message.guildId, false);
      await message.reply('Playback resumed.');
    } else if (cmd === 'stop') {
      await bridge.stop(message.guildId, false);
      await message.reply('Playback stopped and queue cleared.');
    } else if (cmd === 'play' || cmd === 'p') {
      const query = args.join(' ');
      if (!query) {
        await message.reply(`Usage: \`${settings.prefix}play [song name or URL]\``);
        return;
      }
      const member = message.member;
      if (!member?.voice?.channelId) {
        await message.reply('Join a voice channel first.');
        return;
      }
      if (!kazagumo.shoukaku.getIdealNode()) {
        await message.reply(`Lavalink node \`${ctx.config.lavalink.url}\` is currently offline or unreachable.`);
        return;
      }
      const player = await kazagumo.createPlayer({
        guildId: message.guildId,
        textId: message.channelId,
        voiceId: member.voice.channelId,
        volume: settings.defaultVolume,
      });
      const res = await kazagumo.search(query, {
        requester: { id: message.author.id, username: message.author.username },
      });
      if (!res.tracks.length) {
        await message.reply('No matching tracks found.');
        return;
      }
      player.queue.add(res.tracks[0]);
      if (!player.playing && !player.paused) await player.play();
      bridge.syncFromKazagumoPlayer(player, message.guild.name);
      await message.reply(`Queued **${res.tracks[0].title}** by **${res.tracks[0].author}**.`);
    }
  });
}
