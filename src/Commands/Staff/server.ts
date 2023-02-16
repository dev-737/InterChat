import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';

export default {
  staff: true,
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Leaves the specified server. Staff-only.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('leave')
        .setDescription('Leaves the specified server. Staff-only.')
        .addStringOption((stringOption) =>
          stringOption
            .setName('server')
            .setDescription('The server to leave.')
            .setRequired(true),
        )
        .addStringOption((stringOption) =>
          stringOption
            .setName('reason')
            .setDescription('The reason for leaving the server.')
            .setRequired(true),
        )
        .addBooleanOption(boolOption =>
          boolOption
            .setName('notify')
            .setDescription('Whether or not to notify the server about the leave. (Default: true)')
            .setRequired(false),
        ),
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('disconnect')
        .setDescription('Force disconnect from a specified server. Staff-only.')
        .addStringOption((stringOption) =>
          stringOption
            .setName('serverid')
            .setDescription('The server you want to disconnect from the network.')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('connected-list')
        .setDescription('Display the connected servers. (Staff only)'),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    await require(`../../Scripts/server/${subcommand}`).execute(interaction);
  },
};