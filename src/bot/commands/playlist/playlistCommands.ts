import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { TrackItem } from '../../../shared/types.ts';
import { SAMURAI_LOGO_URL } from '../../database/sqlite.ts';
import { formatDuration } from '../../utils/formatters.ts';
import { safeDeferReply, safeRespond } from '../../utils/interactions.ts';
import { validateUserVoiceChannel } from '../../utils/permissions.ts';
import type { SlashCommandModule } from '../types.ts';

export const playlistCommands: SlashCommandModule[] = [
  {
    data: new SlashCommandBuilder()
      .setName('playlist')
      .setDescription('Manage persistent Shadow Music server playlists')
      .addSubcommand((sub) =>
        sub
          .setName('create')
          .setDescription('Create a new custom playlist')
          .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true))
          .addStringOption((o) => o.setName('description').setDescription('Optional description'))
      )
      .addSubcommand((sub) =>
        sub
          .setName('delete')
          .setDescription('Delete a playlist by name')
          .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add the current song or a searched song to a playlist')
          .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true))
          .addStringOption((o) => o.setName('song').setDescription('Song query (defaults to now playing)'))
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a track from a playlist by position')
          .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true))
          .addIntegerOption((o) => o.setName('position').setDescription('1-based track position').setMinValue(1).setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('play')
          .setDescription('Queue and play all tracks from a saved playlist')
          .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true))
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List all saved playlists in this server'))
      .addSubcommand((sub) =>
        sub
          .setName('view')
          .setDescription('View tracks inside a saved playlist')
          .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true))
      ),

    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      if (!interaction.guildId) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }

      const guildId = interaction.guildId;
      if (ctx.db.isBlacklisted(guildId, interaction.user.id)) {
        await safeRespond(interaction, 'You are blacklisted from using Shadow Music in this server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'create') {
        const name = interaction.options.getString('name', true);
        const description = interaction.options.getString('description') || '';
        try {
          const pl = ctx.db.createPlaylist(guildId, interaction.user.id, interaction.user.username, name, description);
          await safeRespond(interaction, `Created playlist **${pl.name}**.`);
        } catch (err: any) {
          await safeRespond(interaction, err?.message || 'Could not create playlist.');
        }
        return;
      }

      if (sub === 'delete') {
        const name = interaction.options.getString('name', true);
        const deleted = ctx.db.deletePlaylist(guildId, name);
        await safeRespond(
          interaction,
          deleted ? `Deleted playlist **${name}**.` : `Playlist **${name}** not found.`
        );
        return;
      }

      if (sub === 'add') {
        const name = interaction.options.getString('name', true);
        const query = interaction.options.getString('song');
        let track: TrackItem | null = null;

        if (query) {
          if (!ctx.kazagumo.shoukaku.getIdealNode()) {
            await safeRespond(
              interaction,
              `Lavalink node \`${ctx.config.lavalink.url}\` is currently offline or unreachable.`
            );
            return;
          }
          try {
            const search = await ctx.kazagumo.search(query, {
              requester: {
                id: interaction.user.id,
                username: interaction.user.username,
                avatarUrl: interaction.user.displayAvatarURL(),
              },
            });
            const first = search.tracks[0];
            if (first) {
              track = {
                id: first.identifier || `tr_${Date.now()}`,
                title: first.title,
                artist: first.author || 'Unknown Artist',
                durationMs: first.length || 0,
                artworkUrl: first.thumbnail || SAMURAI_LOGO_URL,
                uri: first.uri || '',
                source: 'lavalink',
                requestedBy: { id: interaction.user.id, username: interaction.user.username },
                addedAt: Date.now(),
              };
            }
          } catch (err: any) {
            await safeRespond(
              interaction,
              `Lavalink search error: ${err?.message || 'Unable to resolve track.'}`
            );
            return;
          }
        } else {
          track = ctx.bridge.getPlayerState(guildId).currentTrack;
        }

        if (!track) {
          await safeRespond(interaction, 'Provide a song query or play a track first.');
          return;
        }

        try {
          const updated = ctx.db.addTrackToPlaylist(guildId, name, track);
          await safeRespond(
            interaction,
            `Added **${track.title}** to **${updated.name}** (${updated.tracks.length} tracks).`
          );
        } catch (err: any) {
          await safeRespond(interaction, err?.message || 'Failed to add track.');
        }
        return;
      }

      if (sub === 'remove') {
        const name = interaction.options.getString('name', true);
        const pos = interaction.options.getInteger('position', true);
        try {
          const updated = ctx.db.removeTrackFromPlaylist(guildId, name, pos - 1);
          await safeRespond(interaction, `Removed track #${pos} from **${updated.name}**.`);
        } catch (err: any) {
          await safeRespond(interaction, err?.message || 'Failed to remove track.');
        }
        return;
      }

      if (sub === 'play') {
        const name = interaction.options.getString('name', true);
        const pl = ctx.db.getPlaylistByName(guildId, name);
        if (!pl || pl.tracks.length === 0) {
          await safeRespond(interaction, `Playlist **${name}** is empty or does not exist.`);
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
            `Lavalink node \`${ctx.config.lavalink.url}\` is currently offline or unreachable from this network.`
          );
          return;
        }

        try {
          const settings = ctx.db.getGuildSettings(guildId, interaction.guild?.name);
          const player = await ctx.kazagumo.createPlayer({
            guildId,
            textId: interaction.channelId,
            voiceId: voice.voiceChannel.id,
            volume: settings.defaultVolume,
          });

          let queued = 0;
          for (const t of pl.tracks) {
            const res = await ctx.kazagumo.search(t.uri.startsWith('http') ? t.uri : `${t.title} ${t.artist}`, {
              requester: {
                id: interaction.user.id,
                username: interaction.user.username,
                avatarUrl: interaction.user.displayAvatarURL(),
              },
            });
            if (res.tracks[0]) {
              player.queue.add(res.tracks[0]);
              queued++;
            }
          }
          if (queued > 0 && !player.playing && !player.paused) {
            await player.play();
          }
          ctx.bridge.syncFromKazagumoPlayer(player, interaction.guild?.name || 'Discord Server');
          await safeRespond(interaction, `Queued **${queued}** tracks from playlist **${pl.name}**.`);
        } catch (err: any) {
          await safeRespond(interaction, `Playlist playback error: ${err?.message || 'Lavalink node unavailable.'}`);
        }
        return;
      }

      if (sub === 'list') {
        const playlists = ctx.db.getPlaylists(guildId);
        const embed = new EmbedBuilder()
          .setColor(0x18181b)
          .setTitle(`Saved Playlists · ${interaction.guild?.name || 'Server'}`)
          .setDescription(
            playlists.length > 0
              ? playlists.map((p) => `**${p.name}** — ${p.tracks.length} tracks · Owner: ${p.ownerName}`).join('\n')
              : 'No playlists created yet. Use `/playlist create [name]`.'
          );
        await safeRespond(interaction, { embeds: [embed] });
        return;
      }

      if (sub === 'view') {
        const name = interaction.options.getString('name', true);
        const pl = ctx.db.getPlaylistByName(guildId, name);
        if (!pl) {
          await safeRespond(interaction, `Playlist **${name}** not found.`);
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(0x18181b)
          .setTitle(`Playlist: ${pl.name}`)
          .setDescription(
            pl.tracks.length > 0
              ? pl.tracks
                  .slice(0, 20)
                  .map((t, i) => `\`${i + 1}.\` **${t.title}** — ${t.artist} \`[${formatDuration(t.durationMs)}]\``)
                  .join('\n')
              : 'This playlist currently has 0 tracks.'
          )
          .setFooter({ text: `${pl.tracks.length} total tracks · Created by ${pl.ownerName}` });
        await safeRespond(interaction, { embeds: [embed] });
      }
    },
  },
];
