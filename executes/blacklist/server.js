const { sendInFirst } = require('../../utils');

module.exports = {
	async execute(interaction, database) {
		const serverOpt = interaction.options.getString('server');
		const reason = interaction.options.getString('reason');
		const subCommandGroup = interaction.options.getSubcommandGroup();

		const blacklistedServers = database.collection('blacklistedServers');
		const serverInBlacklist = await blacklistedServers.findOne({ serverId: serverOpt });

		if (subCommandGroup == 'add') {
			const server = await interaction.client.guilds.fetch(serverOpt);
			if (serverInBlacklist) {
				await interaction.reply(`The server **${server.name}** is already blacklisted.`);
				return;
			}

			await blacklistedServers.insertOne({
				serverName: server.name,
				serverId: serverOpt,
				reason: reason,
			});

			await sendInFirst(server, `This server has been blacklisted in this bot for reason \`${reason}\`. Please join the support server and contact the staff to get whitelisted and/or if you think the reason is not valid.`);
			await interaction.reply(`The server **${server.name}** has been blacklisted for reason ${reason}.`);
			await server.leave();
		}
		else if (subCommandGroup == 'remove') {
			if (!serverInBlacklist) {
				await interaction.reply(`The server **${serverInBlacklist.serverName}** is not blacklisted.`);
				return;
			}

			await blacklistedServers.deleteOne({ serverId: serverOpt });
			await interaction.reply(`The server **${serverInBlacklist.serverName}** has been removed from the blacklist.`);
		}
	},
};