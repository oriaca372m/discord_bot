const { Client, Attachment } = require('discord.js');
const client = new Client();

const features = require('../config/features.js')

let isFeaturesReady = false

client.on('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`);

	for (const [k, v] of features) {
		try {
			await v.init(client)
		} catch (e) {
			console.error(e)
			process.exit(1)
		}
		isFeaturesReady = true
	}
})

const channelData = new Map()

client.on('message', async (msg) => {
	if (!isFeaturesReady) {
		return
	}

	const channelId = msg.channel.id
	if (!channelData.has(channelId)) {
		const channelInstances = new Map()
		channelData.set(channelId, channelInstances)
		for (const [k, v] of features) {
			const instance = v.createChannelInstance(msg.channel, msg.guild)
			channelInstances.set(k, { instance })
		}
	}
	const channelInstances = channelData.get(channelId)
	await Promise.all(Array.from(channelInstances.values(), async (x) => {
		try {
			await x.instance.onMessage(msg)
		} catch (e) {
			console.error(e)
			msg.channel.send('bot の処理中にエラーが発生しました。')
		}
	}))
});

process.on('SIGINT', async () => {
	client.destroy()
	for (const [k, v] of features) {
		try {
			await v.finalize()
		} catch (e) {
			console.error(e)
		}
	}
	console.log('discord bot was shut down.')
})

client.login(process.env.DISCORD_BOT_TOKEN)
