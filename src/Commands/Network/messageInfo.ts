import { ActionRowBuilder, ApplicationCommandType, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContextMenuCommandBuilder, EmbedBuilder, MessageContextMenuCommandInteraction } from 'discord.js';
import { colors, getDb } from '../../Utils/functions/utils';
import { stripIndents } from 'common-tags';
import { profileImage } from 'discord-arts';

export default {
  description: 'Get information about this message, user and server it was sent from!',
  data: new ContextMenuCommandBuilder()
    .setName('Message Info')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
    const target = interaction.targetMessage;
    const emotes = interaction.client.emotes.normal;
    const networkMessage = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: target.id } } },
      include: { hub: true },
    });

    if (!networkMessage) {
      await interaction.reply({
        content: 'This message has expired. If not, please wait a few seconds and try again.',
        ephemeral: true,
      });
      return;
    }

    const author = await interaction.client.users.fetch(networkMessage.authorId);
    const server = await interaction.client.guilds.fetch(networkMessage.serverId).catch(() => null);

    const embed = new EmbedBuilder()
      .setThumbnail(author.displayAvatarURL())
      .setDescription(stripIndents`
        ## ${emotes.clipart} Message Info

        **Sent By:** 
        __${author.username}__${author.discriminator !== '0' ? `#${author.discriminator}` : ''} ${author.bot ? '(Bot)' : ''}

        **Sent From:**
        __${server?.name}__

        **Message ID:**
        __${target.id}__
        
        **Sent In (Hub):**
        __${networkMessage.hub?.name}__

        **Sent At:**
        <t:${Math.floor(target.createdTimestamp / 1000)}:R>
      `)
      .setColor('Random');

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('messageInfo')
        .setLabel('Message Info')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('serverInfo')
        .setLabel('Server Info')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('userInfo')
        .setLabel('User Info')
        .setStyle(ButtonStyle.Primary),
    );

    const replyMsg = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    });

    // create a variable to store the profile card buffer
    let customCard: AttachmentBuilder | null = null;

    const collector = replyMsg?.createMessageComponentCollector({ time: 30_000 });
    collector.on('collect', async i => {
      if (i.customId === 'serverInfo') {
        if (!server) {
          interaction.reply('Unable to find server!');
          return;
        }

        const owner = await server.fetchOwner();
        const createdAt = Math.round(server.createdTimestamp / 1000);
        const guildSetup = await db.connectedList.findFirst({ where: { serverId: networkMessage.serverId } });

        const serverEmbed = new EmbedBuilder()
          .setColor(colors('invisible'))
          .setThumbnail(server.iconURL())
          .setImage(server.bannerURL())
          .setDescription(stripIndents`
          ## Server Info
          ${server.description || 'No Description.'}

          **Name:**
          ${server?.name.substring(0, 256)}

          **Owner:** 
        __${owner.user.username}__${owner.user.discriminator !== '0' ? `#${owner.user.discriminator}` : ''} ${owner.user.bot ? '(Bot)' : ''}

          **Created:** 
          <t:${createdAt}:d> (<t:${createdAt}:R>)

          **Member Count:** 
          __${server.memberCount}__

          **Invite:**
          __${guildSetup?.invite ? `[\`${guildSetup.invite}\`](https://discord.gg/${guildSetup.invite})` : 'Not Set.'}__`)
          .setFooter({ text: `ID: ${server.id}` });

        const newButtons = ActionRowBuilder.from<ButtonBuilder>(buttons);
        newButtons.components[0].setDisabled(false).setStyle(ButtonStyle.Primary);
        newButtons.components[1].setDisabled(true).setStyle(ButtonStyle.Secondary);

        if (guildSetup?.invite) {
          newButtons.addComponents(new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.gg/${guildSetup?.invite}`)
            .setEmoji(interaction.client.emotes.icons.join)
            .setLabel('Join'));
        }

        await i.update({ embeds: [serverEmbed], components: [newButtons], files: [] });
      }


      else if (i.customId === 'userInfo') {
        await i.deferUpdate();

        const createdAt = Math.round(author.createdTimestamp / 1000);

        const userEmbed = new EmbedBuilder()
          .setThumbnail(author.displayAvatarURL())
          .setColor('Random')
          .setImage(author.bannerURL() ?? null)
          .setDescription(stripIndents`
            ## User Info

            **User Name:**
            __${author.username}__${author.discriminator !== '0' ? `#${author.discriminator}` : ''} ${author.bot ? '(Bot)' : ''}
            
            **ID:**
            __${author.id}__

            **Created:**
            <t:${createdAt}:d> (<t:${createdAt}:R>)
            
            **Display Name:**
            __${author.globalName || 'Not Set.'}__

            **Hubs Owned:**
            __${await db.hubs.count({ where: { ownerId: author.id } })}__
          `)
          .setImage('attachment://customCard.png') // link to image that will be generated afterwards
          .setTimestamp();

        // disable the user info button
        const newButtons = ActionRowBuilder.from<ButtonBuilder>(buttons);
        newButtons.components[0].setDisabled(false).setStyle(ButtonStyle.Primary);
        newButtons.components[2].setDisabled(true).setStyle(ButtonStyle.Secondary);

        // generate the profile card
        if (!customCard) customCard = new AttachmentBuilder(await profileImage(author.id), { name: 'customCard.png' });

        await interaction.editReply({
          embeds: [userEmbed],
          files: [customCard],
          components: [newButtons],
        });
      }
      else if (i.customId === 'messageInfo') {
        await i.update({ embeds: [embed], components: [buttons], files: [] });
      }
    });
  },
};