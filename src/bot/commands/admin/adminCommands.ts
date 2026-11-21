import { ChannelType, GuildMember, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { buildDiscordPlayerMessage } from '../../music/discordPlayerEmbed.ts';
import { safeDeferReply, safeRespond } from '../../utils/interactions.ts';
import { checkAdminPermission } from '../../utils/permissions.ts';
import type { SlashCommandModule } from '../types.ts';

export const adminCommands: SlashCommandModule[] = [
  {
    data: new SlashCommandBuilder().setName('247').setDescription('Toggle 24/7 voice connection mode for this server'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;
      if (!interaction.guildId) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }
      if (!checkAdminPermission(interaction.member as GuildMember)) {
        await safeRespond(interaction, 'Requires Manage Server permission.');
        return;
      }
      const settings = ctx.db.getGuildSettings(interaction.guildId, interaction.guild?.name);
      const updated = ctx.db.upsertGuildSettings({ ...settings, mode247: !settings.mode247 });
      ctx.bridge.applyGuildSettingsUpdate(updated);
      await safeRespond(interaction, `24/7 mode is now **${updated.mode247 ? 'ENABLED' : 'DISABLED'}**.`);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('setdj')
      .setDescription('Set or clear the DJ role for music controls')
      .addRoleOption((opt) => opt.setName('role').setDescription('Role to grant DJ permissions (leave empty to clear)')),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;
      if (!interaction.guildId) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }
      if (!checkAdminPermission(interaction.member as GuildMember)) {
        await safeRespond(interaction, 'Requires Manage Server permission.');
        return;
      }
      const role = interaction.options.getRole('role');
      const settings = ctx.db.getGuildSettings(interaction.guildId, interaction.guild?.name);
      const updated = ctx.db.upsertGuildSettings({
        ...settings,
        djRoleId: role ? role.id : null,
        djRoleName: role ? role.name : null,
      });
      ctx.bridge.applyGuildSettingsUpdate(updated);
      await safeRespond(
        interaction,
        role ? `DJ role set to <@&${role.id}>.` : 'DJ role cleared (everyone may control playback).'
      );
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('setprefix')
      .setDescription('Set the legacy text command prefix')
      .addStringOption((opt) =>
        opt.setName('prefix').setDescription('New prefix (1-5 characters)').setMaxLength(5).setRequired(true)
      ),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;
      if (!interaction.guildId) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }
      if (!checkAdminPermission(interaction.member as GuildMember)) {
        await safeRespond(interaction, 'Requires Manage Server permission.');
        return;
      }
      const prefix = interaction.options.getString('prefix', true).trim();
      const settings = ctx.db.getGuildSettings(interaction.guildId, interaction.guild?.name);
      const updated = ctx.db.upsertGuildSettings({ ...settings, prefix });
      ctx.bridge.applyGuildSettingsUpdate(updated);
      await safeRespond(interaction, `Command prefix updated to \`${updated.prefix}\`.`);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('setchannel')
      .setDescription('Restrict music commands to a specific text channel')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target text channel (leave empty to allow all channels)')
          .addChannelTypes(ChannelType.GuildText)
      ),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;
      if (!interaction.guildId) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }
      if (!checkAdminPermission(interaction.member as GuildMember)) {
        await safeRespond(interaction, 'Requires Manage Server permission.');
        return;
      }
      const channel = interaction.options.getChannel('channel');
      const settings = ctx.db.getGuildSettings(interaction.guildId, interaction.guild?.name);
      const updated = ctx.db.upsertGuildSettings({
        ...settings,
        musicChannelId: channel ? channel.id : null,
        musicChannelName: channel ? `#${channel.name}` : null,
      });
      ctx.bridge.applyGuildSettingsUpdate(updated);
      await safeRespond(
        interaction,
        channel ? `Music commands bound to <#${channel.id}>.` : 'Channel restriction cleared.'
      );
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Create a dedicated #shadow-music controller channel with interactive player'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction, true))) return;
      if (!interaction.guild) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }
      if (!checkAdminPermission(interaction.member as GuildMember)) {
        await safeRespond(interaction, 'Requires Manage Server permission.');
        return;
      }
      const guild = interaction.guild;
      if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        await safeRespond(interaction, 'I need the Manage Channels permission to run `/setup`.');
        return;
      }

      const channel = await guild.channels.create({
        name: 'shadow-music',
        type: ChannelType.GuildText,
        topic: 'Shadow Music — Where Silence Meets Sound. Send a song title or use /play.',
      });

      const settings = ctx.db.getGuildSettings(guild.id, guild.name);
      const updated = ctx.db.upsertGuildSettings({
        ...settings,
        musicChannelId: channel.id,
        musicChannelName: `#${channel.name}`,
      });
      ctx.bridge.applyGuildSettingsUpdate(updated);

      const state = ctx.bridge.getPlayerState(guild.id, guild.name);
      const payload = buildDiscordPlayerMessage(state, ctx.client.user?.displayAvatarURL());
      await channel.send(payload);
      await safeRespond(interaction, `Created <#${channel.id}> and pinned the Shadow Music controller.`);
    },
  },

  {
    data: new SlashCommandBuilder().setName('reset').setDescription('Reset all Shadow Music settings for this server'),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction, true))) return;
      if (!interaction.guildId) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }
      const member = interaction.member as GuildMember;
      if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await safeRespond(interaction, 'Requires Administrator permission.');
        return;
      }
      const reset = ctx.db.resetGuildSettings(interaction.guildId);
      ctx.bridge.applyGuildSettingsUpdate(reset);
      await safeRespond(interaction, 'All server settings have been reset to Shadow Music defaults.');
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('blacklist')
      .setDescription('Blacklist a user from using Shadow Music in this server')
      .addUserOption((opt) => opt.setName('user').setDescription('User to blacklist').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason for blacklist')),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;
      if (!interaction.guildId) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }
      if (!checkAdminPermission(interaction.member as GuildMember)) {
        await safeRespond(interaction, 'Requires Manage Server permission.');
        return;
      }
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'Restricted by server admin';
      ctx.db.addBlacklist({
        guildId: interaction.guildId,
        userId: user.id,
        username: user.username,
        reason,
        addedBy: interaction.user.username,
        addedAt: Date.now(),
      });
      await safeRespond(interaction, `Blacklisted **${user.username}** from Shadow Music (${reason}).`);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('unblacklist')
      .setDescription('Remove a user from the Shadow Music blacklist')
      .addUserOption((opt) => opt.setName('user').setDescription('User to unblacklist').setRequired(true)),
    async execute(interaction, ctx) {
      if (!(await safeDeferReply(interaction))) return;
      if (!interaction.guildId) {
        await safeRespond(interaction, 'Commands must be used inside a Discord server.');
        return;
      }
      if (!checkAdminPermission(interaction.member as GuildMember)) {
        await safeRespond(interaction, 'Requires Manage Server permission.');
        return;
      }
      const user = interaction.options.getUser('user', true);
      const removed = ctx.db.removeBlacklist(interaction.guildId, user.id);
      await safeRespond(
        interaction,
        removed ? `Removed **${user.username}** from the blacklist.` : `**${user.username}** is not blacklisted.`
      );
    },
  },
];
