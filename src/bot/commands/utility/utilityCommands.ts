import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { BOT_COMMANDS_CATALOG } from '../../utils/commandRegistry.ts';
import { formatDuration } from '../../utils/formatters.ts';
import { safeDeferReply, safeRespond } from '../../utils/interactions.ts';
import type { SlashCommandModule } from '../types.ts';

export const utilityCommands: SlashCommandModule[] = [
  {
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Display all Shadow Music commands')
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('Filter by category')
          .addChoices(
            { name: 'Music', value: 'music' },
            { name: 'Playlist', value: 'playlist' },
            { name: 'Utility', value: 'utility' },
            { name: 'Admin', value: 'admin' }
          )
      ),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction, true))) return;

      const cat = interaction.options.getString('category') as 'music' | 'playlist' | 'utility' | 'admin' | null;
      const list = cat ? BOT_COMMANDS_CATALOG.filter((c) => c.category === cat) : BOT_COMMANDS_CATALOG;
      const embed = new EmbedBuilder()
        .setColor(0x18181b)
        .setTitle(`Shadow Music Command Codex${cat ? ` · ${cat.toUpperCase()}` : ''}`)
        .setThumbnail(ctx.client.user?.displayAvatarURL() || null)
        .setDescription(
          list
            .slice(0, 24)
            .map((c) => `\`${c.syntax}\` — ${c.description}`)
            .join('\n')
        )
        .setFooter({ text: `Where Silence Meets Sound · ${BOT_COMMANDS_CATALOG.length} total commands` });
      await safeRespond(interaction, { embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('ping').setDescription('Check Discord gateway and API latency'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const reply = await interaction.fetchReply().catch(() => null);
      const roundtrip = reply
        ? Math.max(0, reply.createdTimestamp - interaction.createdTimestamp)
        : Math.max(0, Date.now() - interaction.createdTimestamp);
      const wsPing = Math.max(0, Math.round(ctx.client.ws.ping));
      await safeRespond(
        interaction,
        `Gateway Ping: **${wsPing}ms** · Interaction Roundtrip: **${roundtrip}ms**`
      );
    },
  },

  {
    data: new SlashCommandBuilder().setName('botinfo').setDescription('Show Shadow Music engine details'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const nodesOnline = Array.from(ctx.kazagumo.shoukaku.nodes.values()).filter((n) => n.state === 1).length;
      const embed = new EmbedBuilder()
        .setColor(0x18181b)
        .setTitle('SHADOW MUSIC')
        .setDescription('Where Silence Meets Sound. Classic Samurai Discord Music Engine.')
        .setThumbnail(ctx.client.user?.displayAvatarURL() || null)
        .addFields(
          { name: 'Servers', value: String(ctx.client.guilds.cache.size), inline: true },
          { name: 'Active Players', value: String(ctx.bridge.getActivePlayersCount()), inline: true },
          { name: 'Lavalink Nodes', value: `${nodesOnline} online`, inline: true },
          { name: 'Runtime', value: `Node ${process.version}`, inline: true },
          { name: 'Dashboard', value: ctx.config.appUrl, inline: false }
        );
      await safeRespond(interaction, { embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('invite').setDescription('Get the Discord bot invite URL for Shadow Music'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction, true))) return;

      const clientId = ctx.config.clientId || ctx.client.user?.id || '';
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=3147776&scope=bot%20applications.commands`;
      await safeRespond(interaction, `Invite **Shadow Music** to your server:\n${inviteUrl}`);
    },
  },

  {
    data: new SlashCommandBuilder().setName('support').setDescription('Get support links and dashboard access'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction, true))) return;

      await safeRespond(interaction, `Support Dojo: ${ctx.config.supportInvite}\nWeb Dashboard: ${ctx.config.appUrl}`);
    },
  },

  {
    data: new SlashCommandBuilder().setName('stats').setDescription('Show persistent SQLite music statistics'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const stats = ctx.db.getStats();
      const embed = new EmbedBuilder()
        .setColor(0x18181b)
        .setTitle('Shadow Music · Persistent Statistics')
        .setThumbnail(ctx.client.user?.displayAvatarURL() || null)
        .addFields(
          { name: 'Tracks Played', value: String(stats.tracksPlayed), inline: true },
          { name: 'Commands Executed', value: String(stats.commandsExecuted), inline: true },
          { name: 'Listening Time', value: formatDuration(stats.totalListeningMs), inline: true }
        );
      await safeRespond(interaction, { embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('uptime').setDescription('Show how long Shadow Music has been online'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      const uptimeMs = Date.now() - ctx.startedAt;
      await safeRespond(interaction, `Shadow Music uptime: **${formatDuration(uptimeMs)}**`);
    },
  },

  {
    data: new SlashCommandBuilder().setName('serverinfo').setDescription('Inspect Shadow Music settings for this server'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;

      if (!interaction.guild) {
        await safeRespond(interaction, 'This command can only be used inside a Discord server.');
        return;
      }
      const guild = interaction.guild;
      const settings = ctx.db.getGuildSettings(guild.id, guild.name);
      const embed = new EmbedBuilder()
        .setColor(0x18181b)
        .setTitle(`Server Configuration · ${guild.name}`)
        .setThumbnail(guild.iconURL() || ctx.client.user?.displayAvatarURL() || null)
        .addFields(
          { name: '24/7 Mode', value: settings.mode247 ? 'Enabled' : 'Disabled', inline: true },
          { name: 'DJ Role', value: settings.djRoleId ? `<@&${settings.djRoleId}>` : 'None', inline: true },
          { name: 'Prefix', value: `\`${settings.prefix}\``, inline: true },
          { name: 'Music Channel', value: settings.musicChannelId ? `<#${settings.musicChannelId}>` : 'Any', inline: true },
          { name: 'Default Volume', value: `${settings.defaultVolume}%`, inline: true },
          { name: 'Autoplay', value: settings.autoplay ? 'Enabled' : 'Off', inline: true }
        );
      await safeRespond(interaction, { embeds: [embed] });
    },
  },
];
