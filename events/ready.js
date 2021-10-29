const { logger } = require('../logger');
const fs = require('fs');
const dotenv = require('dotenv');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		logger.info(`Logged in as ${client.user.tag}`);
		dotenv.config();

		const commands = [];

		fs.readdirSync('./commands').forEach((dir) => {
			if (fs.statSync(`./commands/${dir}`).isDirectory()) {
				const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
				for (const commandFile of commandFiles) {
					const command = require(`../commands/${dir}/${commandFile}`);
					commands.push(command.data.toJSON());
				}
			}
		});

		const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

		rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands })
			.then(() => logger.info('Registered all application command successfully.'))
			.catch(console.error);
	},
};