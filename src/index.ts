import discordjs from 'discord.js'

import FeatureManager from 'Src/features/feature-manager'
import { FeatureGlobalConfig } from 'Src/features/global-config'
import { FileSystemObjectStorage } from 'Src/object-storage'
import { ConfigLoader } from 'Src/config'
import * as path from 'path'

async function main() {
	const storage = (() => {
		const fsPath = process.env.DISCORD_BOT_FILE_SYSTEM_OBJECT_STORAGE_PATH
		if (fsPath !== undefined) {
			return new FileSystemObjectStorage(path.resolve(fsPath))
		}
		return new FileSystemObjectStorage(path.resolve('config'))
	})()

	const config = new ConfigLoader((await storage.readFile('features.toml')).toString('utf-8'))

	{
		const ok = await config.load()
		if (!ok) {
			process.exit(1)
		}
	}

	const client = new discordjs.Client({
		intents: [
			discordjs.Intents.FLAGS.GUILDS,
			discordjs.Intents.FLAGS.GUILD_MESSAGES,
			discordjs.Intents.FLAGS.GUILD_VOICE_STATES,
		],
	})
	const featureManager = new FeatureManager(client)
	featureManager.registerFeature(
		'gc',
		() => new FeatureGlobalConfig(storage, ['messages-default.toml', 'messages.toml'])
	)

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

	client.on('messageCreate', (msg) => {
		void (async (): Promise<void> => {
			if (!ready) {
				return
			}

			if (!msg.partial) {
				await featureManager.onMessage(msg)
			}
		})()
	})

	const shutdown = async () => {
		client.destroy()
		await featureManager.finalize()
		console.log('discord bot was shut down.')
		process.exit(0)
	}

	process.on('SIGINT', () => void shutdown())
	process.on('SIGTERM', () => void shutdown())

	await client.login(config.token)
}

void main()
