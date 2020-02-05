const { Client } = require('discord.js')
const client = new Client()

const FeatureManager = require('./features/feature-manager.js')
const features = require('../config/features.js')

const featureManager = new FeatureManager()

let ready = false

client.on('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`)

	await featureManager.init()

	for (const [k, v] of features) {
		await registerFeature(k, v)
	}

	ready = true
})

const channelData = new Map()

client.on('message', async (msg) => {
	if (!ready) {
		return
	}

	featureManager.onMessage(msg)
})

process.on('SIGINT', async () => {
	client.destroy()
	await featureManager.finalize()
	console.log('discord bot was shut down.')
})

client.login(process.env.DISCORD_BOT_TOKEN)
