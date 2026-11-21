import {
  ActionRowBuilder,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { LoopMode } from '../../../shared/types.ts';
import { buildDiscordPlayerMessage } from '../../music/discordPlayerEmbed.ts';
import { formatDuration, parseTimeToMs, truncateText } from '../../utils/formatters.ts';
import { registerSearchPick, safeDeferReply, safeRespond } from '../../utils/interactions.ts';
import { checkDjPermission, validateUserVoiceChannel } from '../../utils/permissions.ts';
import type { BotContext, SlashCommandModule } from '../types.ts';

function ensureChannelAccess(interaction: any, ctx: BotContext): string | null {
  if (!interaction.guildId) return 'Commands must be used inside a Discord server.';
  if (ctx.db.isBlacklisted(interaction.guildId, interaction.user.id)) {
    return 'You are blacklisted from using Shadow Music in this server.';
  }
  const settings = ctx.db.getGuildSettings(interaction.guildId);
  if (settings.musicChannelId && interaction.channelId !== settings.musicChannelId) {
    return `Music commands are restricted to <#${settings.musicChannelId}>.`;
  }
  return null;
}

export const musicCommands: SlashCommandModule[] = [
  {
    data: new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play a song or playlist by search query or URL')
      .addStringOption((opt) =>
        opt.setName('query').setDescription('Song title, artist, or supported URL').setRequired(true)
      ),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }

      const voice = validateUserVoiceChannel(interaction, false);
      if (!voice.ok || !voice.voiceChannel) {
        await safeRespond(interaction, voice.error || 'Join a voice channel first.');
        return;
      }

      const query = interaction.options.getString('query', true);
      const guildId = interaction.guildId!;
      const settings = ctx.db.getGuildSettings(guildId, interaction.guild?.name);

      if (!ctx.kazagumo.shoukaku.getIdealNode()) {
        await safeRespond(
          interaction,
          `Lavalink node \`${ctx.config.lavalink.url}\` is currently offline or unreachable from this network.`
        );
        return;
      }

      try {
        const player = await ctx.kazagumo.createPlayer({
          guildId,
          textId: interaction.channelId,
          voiceId: voice.voiceChannel.id,
          volume: settings.defaultVolume,
        });

        const result = await ctx.kazagumo.search(query, {
          requester: {
            id: interaction.user.id,
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL(),
          },
        });

        if (!result.tracks.length) {
          await safeRespond(interaction, 'No matching tracks were returned by Lavalink.');
          return;
        }

        if (result.type === 'PLAYLIST') {
          for (const track of result.tracks) {
            player.queue.add(track);
          }
          if (!player.playing && !player.paused) await player.play();
          ctx.bridge.syncFromKazagumoPlayer(player, interaction.guild?.name || 'Discord Server');
          await safeRespond(
            interaction,
            `Queued **${result.tracks.length}** tracks from **${result.playlistName || 'Playlist'}**.`
          );
        } else {
          const track = result.tracks[0];
          player.queue.add(track);
          if (!player.playing && !player.paused) await player.play();
          ctx.bridge.syncFromKazagumoPlayer(player, interaction.guild?.name || 'Discord Server');
          const payload = buildDiscordPlayerMessage(
            ctx.bridge.getPlayerState(guildId),
            ctx.client.user?.displayAvatarURL()
          );
          await safeRespond(interaction, {
            content: `Queued **${track.title}** by **${track.author}**`,
            ...payload,
          });
        }
      } catch (err: any) {
        await safeRespond(interaction, `Playback error: ${err?.message || 'Lavalink node unavailable.'}`);
      }
    },
  },

  {
    data: new SlashCommandBuilder().setName('pause').setDescription('Pause the active music player'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const voice = validateUserVoiceChannel(interaction, true);
      if (!voice.ok) {
        await safeRespond(interaction, voice.error!);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const current = ctx.bridge.getPlayerState(interaction.guildId!);
      if (!current.currentTrack) {
        await safeRespond(interaction, 'No track is currently loaded.');
        return;
      }
      await ctx.bridge.togglePause(interaction.guildId!, true);
      await safeRespond(interaction, 'Playback paused.');
    },
  },

  {
    data: new SlashCommandBuilder().setName('resume').setDescription('Resume a paused music player'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const voice = validateUserVoiceChannel(interaction, true);
      if (!voice.ok) {
        await safeRespond(interaction, voice.error!);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const current = ctx.bridge.getPlayerState(interaction.guildId!);
      if (!current.currentTrack) {
        await safeRespond(interaction, 'No track is currently loaded.');
        return;
      }
      await ctx.bridge.togglePause(interaction.guildId!, false);
      await safeRespond(interaction, 'Playback resumed.');
    },
  },

  {
    data: new SlashCommandBuilder().setName('skip').setDescription('Skip or vote-skip the current track'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const voice = validateUserVoiceChannel(interaction, true);
      if (!voice.ok || !voice.voiceChannel) {
        await safeRespond(interaction, voice.error!);
        return;
      }
      const guildId = interaction.guildId!;
      const member = interaction.member as GuildMember;
      const dj = checkDjPermission(member, ctx.db, guildId);
      const settings = ctx.db.getGuildSettings(guildId);

      if (dj.allowed || !settings.voteSkipEnabled) {
        const state = await ctx.bridge.skip(guildId);
        await safeRespond(
          interaction,
          state.currentTrack
            ? `Skipped to **${state.currentTrack.title}**.`
            : 'Skipped current track. Queue is now empty.'
        );
        return;
      }

      const listeners = voice.voiceChannel.members.filter((m) => !m.user.bot).size;
      const vote = ctx.bridge.castVoteSkip(guildId, interaction.user.id, listeners);
      if (vote.skipped) {
        await safeRespond(interaction, `Vote skip passed (${vote.count}/${vote.required}). Advancing track.`);
      } else {
        await safeRespond(interaction, `Vote skip recorded (${vote.count}/${vote.required} required).`);
      }
    },
  },

  {
    data: new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const voice = validateUserVoiceChannel(interaction, true);
      if (!voice.ok) {
        await safeRespond(interaction, voice.error!);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      await ctx.bridge.stop(interaction.guildId!, false);
      await safeRespond(interaction, 'Playback stopped and queue cleared.');
    },
  },

  {
    data: new SlashCommandBuilder().setName('leave').setDescription('Disconnect Shadow Music from voice'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const voice = validateUserVoiceChannel(interaction, true);
      if (!voice.ok) {
        await safeRespond(interaction, voice.error!);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      await ctx.bridge.stop(interaction.guildId!, true);
      await safeRespond(interaction, 'Shadow Music has left the voice channel.');
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('queue')
      .setDescription('View the upcoming track queue')
      .addIntegerOption((opt) => opt.setName('page').setDescription('Page number').setMinValue(1)),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }

      const state = ctx.bridge.getPlayerState(interaction.guildId!, interaction.guild?.name);
      const page = interaction.options.getInteger('page') || 1;
      const perPage = 10;
      const totalPages = Math.max(1, Math.ceil(state.queue.length / perPage));
      const safePage = Math.min(page, totalPages);
      const slice = state.queue.slice((safePage - 1) * perPage, safePage * perPage);

      const embed = new EmbedBuilder()
        .setColor(0x18181b)
        .setTitle(`Server Queue · ${state.guildName}`)
        .setThumbnail(ctx.client.user?.displayAvatarURL() || null)
        .setDescription(
          (state.currentTrack
            ? `**Now Playing:** ${state.currentTrack.title} — ${state.currentTrack.artist} \`[${formatDuration(state.currentTrack.durationMs)}]\`\n\n`
            : '') +
            (slice.length > 0
              ? slice
                  .map(
                    (t, i) =>
                      `\`${(safePage - 1) * perPage + i + 1}.\` **${truncateText(t.title, 42)}** — ${truncateText(t.artist, 24)} \`[${formatDuration(t.durationMs)}]\``
                  )
                  .join('\n')
              : 'No upcoming tracks in queue.')
        )
        .setFooter({ text: `Page ${safePage}/${totalPages} · ${state.queue.length} upcoming` });

      await safeRespond(interaction, { embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the interactive Shadow Music player'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }

      const state = ctx.bridge.getPlayerState(interaction.guildId!, interaction.guild?.name);
      const payload = buildDiscordPlayerMessage(state, ctx.client.user?.displayAvatarURL());
      await safeRespond(interaction, payload);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('volume')
      .setDescription('Set player volume (1 to 100)')
      .addIntegerOption((opt) =>
        opt.setName('level').setDescription('Volume percentage (1-100)').setMinValue(1).setMaxValue(100).setRequired(true)
      ),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const level = interaction.options.getInteger('level', true);
      await ctx.bridge.setVolume(interaction.guildId!, level);
      await safeRespond(interaction, `Volume set to **${level}%**.`);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('seek')
      .setDescription('Seek to a timestamp in the current track (e.g. 1:30 or 90s)')
      .addStringOption((opt) => opt.setName('time').setDescription('Target timestamp').setRequired(true)),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const current = ctx.bridge.getPlayerState(interaction.guildId!);
      if (!current.currentTrack) {
        await safeRespond(interaction, 'No track is currently playing.');
        return;
      }
      const raw = interaction.options.getString('time', true);
      const ms = parseTimeToMs(raw);
      if (ms === null) {
        await safeRespond(interaction, 'Invalid time format. Use `1:30` or `90s`.');
        return;
      }
      await ctx.bridge.seek(interaction.guildId!, ms);
      await safeRespond(interaction, `Seeked to **${formatDuration(ms)}**.`);
    },
  },

  {
    data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the upcoming queue'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const state = ctx.bridge.toggleShuffle(interaction.guildId!);
      await safeRespond(interaction, `Queue shuffled (${state.queue.length} tracks).`);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('loop')
      .setDescription('Set loop mode')
      .addStringOption((opt) =>
        opt
          .setName('mode')
          .setDescription('Loop mode')
          .setRequired(true)
          .addChoices(
            { name: 'Off', value: 'off' },
            { name: 'Song', value: 'song' },
            { name: 'Queue', value: 'queue' }
          )
      ),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const mode = interaction.options.getString('mode', true) as LoopMode;
      ctx.bridge.cycleLoop(interaction.guildId!, mode);
      await safeRespond(interaction, `Loop mode set to **${mode.toUpperCase()}**.`);
    },
  },

  {
    data: new SlashCommandBuilder().setName('previous').setDescription('Play the previous track'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const state = await ctx.bridge.previous(interaction.guildId!);
      await safeRespond(
        interaction,
        state.currentTrack
          ? `Returned to **${state.currentTrack.title}**.`
          : 'No previous track in history.'
      );
    },
  },

  {
    data: new SlashCommandBuilder().setName('clear').setDescription('Clear all upcoming tracks from the queue'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      ctx.bridge.clearQueue(interaction.guildId!);
      await safeRespond(interaction, 'Upcoming queue cleared.');
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('remove')
      .setDescription('Remove a track from the queue by position')
      .addIntegerOption((opt) => opt.setName('position').setDescription('1-based queue position').setMinValue(1).setRequired(true)),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const pos = interaction.options.getInteger('position', true);
      const removed = ctx.bridge.removeQueueItem(interaction.guildId!, pos - 1);
      if (!removed) {
        await safeRespond(interaction, `No track exists at position #${pos}.`);
        return;
      }
      await safeRespond(interaction, `Removed **${removed.title}** from position #${pos}.`);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('move')
      .setDescription('Move a track in the queue from one position to another')
      .addIntegerOption((opt) => opt.setName('from').setDescription('Source position').setMinValue(1).setRequired(true))
      .addIntegerOption((opt) => opt.setName('to').setDescription('Target position').setMinValue(1).setRequired(true)),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const dj = checkDjPermission(interaction.member as GuildMember, ctx.db, interaction.guildId!);
      if (!dj.allowed) {
        await safeRespond(interaction, dj.reason!);
        return;
      }
      const from = interaction.options.getInteger('from', true);
      const to = interaction.options.getInteger('to', true);
      const ok = ctx.bridge.moveQueueItem(interaction.guildId!, from - 1, to - 1);
      await safeRespond(interaction, ok ? `Moved track #${from} to #${to}.` : 'Invalid source or destination queue index.');
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('lyrics')
      .setDescription('Show lyrics for the current song or a queried title')
      .addStringOption((opt) => opt.setName('song').setDescription('Optional song title')),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }

      const state = ctx.bridge.getPlayerState(interaction.guildId!, interaction.guild?.name);
      const query = interaction.options.getString('song') || state.currentTrack?.title;
      if (!query) {
        await safeRespond(interaction, 'Specify a song title or start playback first.');
        return;
      }
      try {
        const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
        const items = (await res.json()) as Array<{ trackName: string; artistName: string; plainLyrics?: string }>;
        if (!Array.isArray(items) || items.length === 0 || !items[0].plainLyrics) {
          await safeRespond(interaction, `No lyrics found for **${query}** (instrumental or unavailable).`);
          return;
        }
        const hit = items[0];
        const embed = new EmbedBuilder()
          .setColor(0x18181b)
          .setTitle(`${hit.trackName} — ${hit.artistName}`)
          .setDescription((hit.plainLyrics || '').slice(0, 3900))
          .setFooter({ text: 'Shadow Music · Lyrics' });
        await safeRespond(interaction, { embeds: [embed] });
      } catch {
        await safeRespond(interaction, `Unable to fetch lyrics for **${query}** right now.`);
      }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('search')
      .setDescription('Search tracks and pick one from an interactive dropdown')
      .addStringOption((opt) => opt.setName('song').setDescription('Search query').setRequired(true)),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction, true))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const voice = validateUserVoiceChannel(interaction, false);
      if (!voice.ok) {
        await safeRespond(interaction, voice.error!);
        return;
      }
      if (!ctx.kazagumo.shoukaku.getIdealNode()) {
        await safeRespond(
          interaction,
          `Lavalink node \`${ctx.config.lavalink.url}\` is currently offline or unreachable.`
        );
        return;
      }
      try {
        const query = interaction.options.getString('song', true);
        const result = await ctx.kazagumo.search(query, {
          requester: {
            id: interaction.user.id,
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL(),
          },
        });
        const top = result.tracks.slice(0, 5);
        if (!top.length) {
          await safeRespond(interaction, 'No tracks matched your query.');
          return;
        }

        const pickBatch = Date.now().toString(36);
        const menu = new StringSelectMenuBuilder()
          .setCustomId('sm_search_pick')
          .setPlaceholder('Select a track to queue')
          .addOptions(
            top.map((t, idx) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`${idx + 1}. ${truncateText(t.title, 45)}`)
                .setDescription(`${truncateText(t.author || 'Unknown Artist', 35)} · ${formatDuration(t.length || 0)}`)
                .setValue(registerSearchPick(`${pickBatch}:${idx}`, t.uri || t.title))
            )
          );

        await safeRespond(interaction, {
          content: `Search results for **${query}**:`,
          components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
        });
      } catch (err: any) {
        await safeRespond(interaction, `Search error: ${err?.message || 'Lavalink search failed.'}`);
      }
    },
  },

  {
    data: new SlashCommandBuilder().setName('join').setDescription('Summon Shadow Music to your voice channel'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const blocked = ensureChannelAccess(interaction, ctx);
      if (blocked) {
        await safeRespond(interaction, blocked);
        return;
      }
      const voice = validateUserVoiceChannel(interaction, false);
      if (!voice.ok || !voice.voiceChannel) {
        await safeRespond(interaction, voice.error!);
        return;
      }
      if (!ctx.kazagumo.shoukaku.getIdealNode()) {
        await safeRespond(
          interaction,
          `Lavalink node \`${ctx.config.lavalink.url}\` is currently offline or unreachable.`
        );
        return;
      }
      try {
        const settings = ctx.db.getGuildSettings(interaction.guildId!, interaction.guild?.name);
        await ctx.kazagumo.createPlayer({
          guildId: interaction.guildId!,
          textId: interaction.channelId,
          voiceId: voice.voiceChannel.id,
          volume: settings.defaultVolume,
        });
        await safeRespond(interaction, `Connected to <#${voice.voiceChannel.id}>.`);
      } catch (err: any) {
        await safeRespond(interaction, `Voice join error: ${err?.message || 'Unable to connect to voice channel.'}`);
      }
    },
  },
];
