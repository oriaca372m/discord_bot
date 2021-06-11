import discordjs from 'discord.js'

import FeatureManager from 'Src/features/feature-manager'
import { ConfigLoader } from 'Src/config'

async function main() {
	const config = new ConfigLoader('./config/features.toml')

	{
		const ok = await config.load()
		if (!ok) {
			process.exit(1)
		}
	}

	const client = new discordjs.Client()
	const featureManager = new FeatureManager(client)

	let ready = false

	client.on('ready', () => {
		void (async (): Promise<void> => {
			if (client.user) {
				console.log(`Logged in as ${client.user.tag}!`)
			}

			try {
				for (const [k, v] of config.features) {
					featureManager.registerFeature(k, () => v)
				}

				await featureManager.init()
			} catch (e) {
				console.error(e)
				process.exit(1)
			}

			ready = true
		})()
	})

	client.on('message', (msg) => {
		void (async (): Promise<void> => {
			if (!ready) {
				return
			}

			if (!msg.partial) {
				await featureManager.onMessage(msg)
			}
		})()
	})

	process.on('SIGINT', () => {
		void (async (): Promise<void> => {
			client.destroy()
			await featureManager.finalize()
			console.log('discord bot was shut down.')
			process.exit(0)
		})()
	})

	await client.login(config.token)
}

void main()
