import { showOnboarding } from '#main/scripts/network/onboarding.js';
import { connectChannel, getAllConnections } from '#main/utils/ConnectedList.js';
import { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { logJoinToHub } from '#main/utils/HubLogger/JoinLeave.js';
import { t } from '#main/utils/Locale.js';
import { getOrCreateWebhook, sendToHub, simpleEmbed } from '#main/utils/Utils.js';
import { hubs } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { ChannelType, ChatInputCommandInteraction } from 'discord.js';
import Hub from './index.js';

export default class JoinSubCommand extends Hub {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    const { userManager, serverBlacklists } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    // NOTE: Change later
    const hubName = interaction.options.getString('hub') ?? 'InterChat Central';
    const invite = interaction.options.getString('invite');
    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    ]);

    if (!channel.permissionsFor(interaction.member).has('ManageMessages')) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'errors.missingPermissions', locale },
              { permissions: 'Manage Messages', emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const channelInHub = await db.connectedList.findFirst({ where: { channelId: channel.id } });
    if (channelInHub) {
      const alrJoinedHub = await db.hubs.findFirst({ where: { id: channelInHub.hubId } });
      await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.alreadyJoined', locale },
              { channel: `${channel.toString()}`, hub: `${alrJoinedHub?.name}`, emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    let hub: hubs | null = null;

    // bunch of checks to see if hub exists / invite is valid
    if (invite) {
      const fetchedInvite = await db.hubInvites.findFirst({
        where: { code: invite },
        include: { hub: true },
      });

      if (!fetchedInvite) {
        await interaction.reply({
          embeds: [
            simpleEmbed(
              t({ phrase: 'hub.invite.revoke.invalidCode', locale }, { emoji: emojis.no }),
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      hub = fetchedInvite.hub;
    }
    else {
      hub = await db.hubs.findFirst({ where: { name: hubName, private: false } });
    }

    if (!hub) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    // actual code starts here
    const alreadyInHub = await db.connectedList.findFirst({
      where: {
        hubId: hub.id,
        serverId: channel.guildId,
      },
    });

    if (alreadyInHub) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.alreadyJoined', locale },
              { hub: hub.name, channel: `<#${alreadyInHub.channelId}>`, emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const userBlacklisted = await userManager.fetchBlacklist(hub.id, interaction.user.id);
    const serverBlacklisted = await serverBlacklists.fetchBlacklist(hub.id, interaction.guildId);

    if (userBlacklisted || serverBlacklisted) {
      await interaction.reply({
        embeds: [simpleEmbed(t({ phrase: 'errors.blacklisted', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    // display onboarding message, also prevents user from joining twice
    const onboardingCompleted = await showOnboarding(interaction, hub.name, channel.id);
    // if user cancels onboarding or it times out
    if (!onboardingCompleted) {
      await interaction.deleteReply().catch(() => null);
      return;
    }
    else if (onboardingCompleted === 'in-progress') {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'network.onboarding.inProgress', locale },
              { channel: `${channel}`, emoji: emojis.dnd_anim },
            ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const webhook = await getOrCreateWebhook(channel);
    if (!webhook) {
      await interaction.editReply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'errors.botMissingPermissions', locale },
              { permissions: 'Manage Webhooks', emoji: emojis.no },
            ),
          ),
        ],
        components: [],
      });
      return;
    }

    // finally make the connection
    await connectChannel({
      serverId: channel.guildId,
      channelId: channel.id,
      parentId: channel.isThread() ? channel.parentId : undefined,
      webhookURL: webhook.url,
      hub: { connect: { id: hub.id } },
      connected: true,
      compact: true,
      profFilter: true,
    });

    await interaction.editReply({
      content: t({ phrase: 'hub.join.success', locale }, { channel: `${channel}`, hub: hub.name }),
      embeds: [],
      components: [],
    });

    const totalConnections =
      (await getAllConnections())?.reduce(
        (total, c) => total + (c.hubId === hub.id && c.connected ? 1 : 0),
        0,
      ) ?? 0;

    // announce
    await sendToHub(hub.id, {
      username: `InterChat | ${hub.name}`,
      content: stripIndents`
      A new server has joined the hub! ${emojis.clipart}

      **Server Name:** __${interaction.guild.name}__
      **Member Count:** __${interaction.guild.memberCount}__

      We now have **${totalConnections}** servers with us!
    `,
    });

    // send log
    await logJoinToHub(hub.id, interaction.guild, {
      totalConnections,
      hubName,
    });
  }
}
