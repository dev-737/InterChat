import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Status,
  time,
} from 'discord.js';
import db from '../../../utils/Db.js';
import BaseCommand from '../../../core/BaseCommand.js';
import { cpus, totalmem } from 'os';
import { LINKS, colors, emojis, isDevBuild } from '../../../utils/Constants.js';
import { stripIndents } from 'common-tags';
import { CustomID } from '../../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../../decorators/Interaction.js';
import { msToReadable } from '../../../utils/Utils.js';

export default class Stats extends BaseCommand {
  override readonly data = {
    name: 'stats',
    description: 'View InterChat\'s statistics.',
    integration_types: [0, 1], // 0 = GUILD_INSTALL, 1 = USER_INSTALL
    contexts: [0, 1, 2], // 0 = GUILD, 1 = BOT_DM, 2 = PRIVATE_CHANNEL
  };

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const { originalMessages, hubs } = db;
    const totalHubs = await hubs?.count();
    const totalNetworkMessages = await originalMessages.count();

    const guildCount: number[] =
      await interaction.client.cluster.fetchClientValues('guilds.cache.size');
    const memberCount: number[] = await interaction.client.cluster.fetchClientValues(
      'guilds.cache.reduce((p, n) => p + n.memberCount, 0)',
    );

    const upSince = new Date(Date.now() - interaction.client.uptime);
    const totalMemory = Math.round(totalmem() / 1024 / 1024 / 1024);
    const memoryUsedRaw = await interaction.client.cluster.broadcastEval(() =>
      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    );
    const memoryUsed = memoryUsedRaw.reduce((p, n) => p + (n ?? 0), 0);

    const embed = new EmbedBuilder()
      .setColor(colors.interchatBlue)
      .setTitle(`${interaction.client.user.username} Statistics`)
      .setFooter({
        text: `InterChat v${interaction.client.version}${isDevBuild ? '+dev' : ''}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .addFields([
        {
          name: 'Bot Stats',
          value: stripIndents`
	          Up Since: ${time(upSince, 'R')}
            Servers: ${guildCount.reduce((p, n) => p + n, 0)}
	          Members: ${memberCount.reduce((p, n) => p + n, 0)}`,
          inline: true,
        },
        {
          name: 'System Stats',
          value: stripIndents`
            OS: Linux
            CPU Cores: ${cpus().length}
            RAM Usage: ${memoryUsed} MB / ${totalMemory} GB`,
          inline: true,
        },
        {
          name: 'Hub Stats',
          value: stripIndents`
            Total Hubs: ${totalHubs}
            Messages (Today): ${totalNetworkMessages}`,
          inline: false,
        },
      ]);

    const linksRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Guide')
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojis.docs_icon)
        .setURL(LINKS.DOCS),
      new ButtonBuilder()
        .setLabel('Support')
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojis.code_icon)
        .setURL(LINKS.SUPPORT_INVITE),
      new ButtonBuilder()
        .setLabel('Invite')
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojis.add_icon)
        .setURL(`https://discord.com/application-directory/${interaction.client.user?.id}`),
    );
    const otherBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Shard Info')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.crystal)
        .setCustomId(new CustomID().setIdentifier('stats', 'shardStats').toString()),
    );

    await interaction.editReply({ embeds: [embed], components: [linksRow, otherBtns] });
  }

  @RegisterInteractionHandler('stats')
  override async handleComponents(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);

    const allCusterData = await interaction.client.cluster.broadcastEval((client) =>
      client.ws.shards.map((shard) => ({
        id: shard.id,
        status: shard.status,
        ping: shard.ping,
        uptime: shard.manager.client.uptime,
        totalGuilds: shard.manager.client.guilds.cache.size,
        memUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      })),
    );

    if (customId.suffix !== 'shardStats') return;

    const embed = new EmbedBuilder()
      .setColor(colors.invisible)
      .setDescription(
        stripIndents`
					### Shard Stats
					**Total Shards:** ${interaction.client.cluster.info.TOTAL_SHARDS} 
					**On Shard:** ${interaction.guild?.shardId ?? 0}
					`,
      )
      .setFields(
        allCusterData.flat().map((shard) => ({
          name: `Shard #${shard.id} - ${Status[shard.status]}`,
          value: stripIndents`\`\`\`elm
              Ping: ${shard.ping}ms
              Uptime: ${shard.uptime ? msToReadable(shard.uptime) : '0 ms'}
              Servers: ${shard.totalGuilds}
              RAM Usage: ${shard.memUsage} MB
              \`\`\`
            `,
          inline: true,
        })),
      )
      .setFooter({
        text: `InterChat v${interaction.client.version}${isDevBuild ? '+dev' : ''}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
