import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
export default {
	data: new SlashCommandBuilder()
		.setName('find')
		.setDescription('Find users/servers by name or ID.')
		.addStringOption((option) =>
			option
				.setName('type')
				.setDescription('Specify if you want to get data on a user or guild.')
				.setRequired(true)
				.addChoices({ name: 'Server', value: 'server' }, { name: 'User', value: 'user' }),
		)
		.addStringOption((option) =>
			option
				.setRequired(true)
				.setName('name-id')
				.setDescription('The name or ID of your target.')
				.setAutocomplete(true),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const data = interaction.options.getString('name-id');
		const type = interaction.options.getString('type');

		require(`../../Scripts/find/${type}`).execute(interaction, data);
	},
	async autocomplete(interaction: AutocompleteInteraction) {
		const type = interaction.options.getString('type');
		switch (type) {
		case 'server': {
			const guilds = interaction.client.guilds.cache;
			const focusedValue = interaction.options.getFocused().toLowerCase();
			const choices: {name: string, id: string}[] = [];

			guilds.map((guild) => choices.push({ name: guild.name, id: guild.id }));
			const filtered = choices
				.filter((choice) => choice.name.toLowerCase().includes(focusedValue) || choice.id.toLowerCase().includes(focusedValue))
				.slice(0, 25)
				.map((choice) => ({ name: choice.name, value: choice.id }));

			interaction.respond(filtered);
			break;
		}

		case 'user': {
			const users = interaction.client.users.cache;
			const focusedValue = interaction.options.getFocused().toLowerCase();
			const choices: {tag: string, id: string}[] = [];

			users.map((user) => choices.push({ tag: user.tag, id: user.id }));
			const filtered = choices
				.filter((choice) => choice.tag.toLowerCase().includes(focusedValue) || choice.id.toLowerCase().includes(focusedValue))
				.slice(0, 25)
				.map((choice) => ({ name: choice.tag, value: choice.id }));

			interaction.respond(filtered);
			break;
		}
		default:
			break;
		}


	},
};
