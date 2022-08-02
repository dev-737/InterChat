// TODO: Remove this file from Developer folder
const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('User ID')
		.setType(ApplicationCommandType.Message),
	async execute(interaction) {
		const args = interaction.targetMessage;
		if (
			!args ||
			!args.embeds[0] ||
			!args.embeds[0].author ||
			!args.embeds[0].author.url ||
			args.author.id != interaction.client.user.id
		) {
			return await interaction.reply({
				content: 'Invalid usage.',
				ephemeral: true,
			});
		}

		const msgAuthor = args.embeds[0].author.url.split('/');
		const userId = msgAuthor[msgAuthor.length - 1];

		await interaction.reply({ content: userId, ephemeral: true });
	},
};