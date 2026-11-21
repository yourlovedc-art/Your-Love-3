import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { GuildPlayerState } from '../../shared/types.ts';
import { buildProgressBar, formatDuration, truncateText } from '../utils/formatters.ts';

export function buildDiscordPlayerMessage(state: GuildPlayerState, samuraiAvatarUrl?: string) {
  const track = state.currentTrack;

  const embed = new EmbedBuilder()
    .setColor(0x18181b)
    .setAuthor({
      name: 'SHADOW MUSIC  ·  Where Silence Meets Sound.',
      iconURL: samuraiAvatarUrl,
    });

  if (!track) {
    embed
      .setTitle('No Track Currently Playing')
      .setDescription('Use `/play [song]` or queue a track from the Shadow Music Dashboard.')
      .setThumbnail(samuraiAvatarUrl || null)
      .addFields(
        { name: 'Queue', value: `${state.queue.length} tracks`, inline: true },
        { name: 'Volume', value: `${state.volume}%`, inline: true },
        { name: 'Loop', value: state.loop.toUpperCase(), inline: true }
      )
      .setFooter({ text: `Server: ${state.guildName}` });
  } else {
    const progress = buildProgressBar(state.positionMs, track.durationMs, 16);
    const loopLabel = state.loop === 'off' ? 'Off' : state.loop === 'song' ? 'Song' : 'Queue';

    embed
      .setTitle(truncateText(track.title, 72))
      .setURL(track.uri.startsWith('http') ? track.uri : null)
      .setDescription(
        `**${track.artist}**\n\n` +
          `\`${formatDuration(state.positionMs)}\` ${progress} \`${formatDuration(track.durationMs)}\``
      )
      .setThumbnail(
        track.artworkUrl.startsWith('http') ? track.artworkUrl : samuraiAvatarUrl || null
      )
      .addFields(
        { name: 'Requested By', value: track.requestedBy.username, inline: true },
        { name: 'Queue Position', value: `Playing · ${state.queue.length} upcoming`, inline: true },
        { name: 'Volume', value: `${state.volume}%`, inline: true },
        { name: 'Loop', value: loopLabel, inline: true },
        { name: 'Shuffle', value: state.shuffle ? 'Enabled' : 'Off', inline: true },
        { name: 'State', value: state.paused ? 'Paused' : 'Playing', inline: true }
      )
      .setFooter({ text: `Shadow Music · ${state.guildName}` })
      .setTimestamp();
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('sm_previous')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.previousTracks.length === 0),
    new ButtonBuilder()
      .setCustomId('sm_toggle_pause')
      .setLabel(state.paused ? 'Resume' : 'Pause')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!track),
    new ButtonBuilder()
      .setCustomId('sm_skip')
      .setLabel('Skip')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!track),
    new ButtonBuilder()
      .setCustomId('sm_stop')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!track && state.queue.length === 0),
    new ButtonBuilder()
      .setCustomId('sm_loop')
      .setLabel(`Loop: ${state.loop === 'off' ? 'Off' : state.loop === 'song' ? 'Song' : 'Queue'}`)
      .setStyle(state.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('sm_shuffle')
      .setLabel(state.shuffle ? 'Shuffle: On' : 'Shuffle')
      .setStyle(state.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(state.queue.length < 2),
    new ButtonBuilder()
      .setCustomId('sm_queue')
      .setLabel(`Queue (${state.queue.length})`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('sm_vol_down')
      .setLabel('Vol -')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.volume <= 1),
    new ButtonBuilder()
      .setCustomId('sm_vol_up')
      .setLabel('Vol +')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.volume >= 100)
  );

  const components: ActionRowBuilder<any>[] = [row1, row2];

  if (state.queue.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('sm_queue_jump')
      .setPlaceholder('Jump to track in queue...')
      .addOptions(
        state.queue.slice(0, 20).map((qTrack, idx) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${idx + 1}. ${truncateText(qTrack.title, 45)}`)
            .setDescription(`${truncateText(qTrack.artist, 40)} · ${formatDuration(qTrack.durationMs)}`)
            .setValue(String(idx))
        )
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  return { embeds: [embed], components };
}
