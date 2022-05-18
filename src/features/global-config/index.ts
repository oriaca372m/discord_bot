import TOML from '@iarna/toml'
import lodash from 'lodash'
import * as discordjs from 'discord.js'
import { FeatureBase } from 'Src/features/feature'
import { ObjectStorage } from 'Src/object-storage'

import * as utils from 'Src/utils'

type Message = string | (string | { text: string; weight?: number })[]

type Messages = {
	readonly [_: string]: Message | Messages
}

type Config = {
	readonly message: { [_: string]: Messages }
}

export class FeatureGlobalConfig extends FeatureBase {
	private config: Config | undefined
	private readonly templateCache = new Map<string, lodash.TemplateExecutor>()
	readonly priority = 50000
	readonly #defaultObjectStorage: ObjectStorage

	constructor(defaultObjectStorage: ObjectStorage, private paths: string[]) {
		super()
		this.#defaultObjectStorage = defaultObjectStorage
	}

	protected async initImpl(): Promise<void> {
		let config = {}
		for (const path of this.paths) {
			let toml
			try {
				toml = (await this.defaultObjectStorage.readFile(path)).toString('utf-8')
			} catch (_) {
				// pass
			}

			if (toml !== undefined) {
				const parsed = await TOML.parse.async(toml)
				config = lodash.merge(config, parsed)
			}
		}

		this.config = config as Config
	}

	async send(
		msg: discordjs.Message,
		key: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		args: any = {},
		options: discordjs.MessageOptions = {}
	): Promise<discordjs.Message | discordjs.Message[]> {
		return await this.sendToChannel(msg.channel, key, args, options)
	}

	async sendToChannel(
		channel: utils.LikeTextChannel,
		key: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		args: any = {},
		options: discordjs.MessageOptions = {}
	): Promise<discordjs.Message | discordjs.Message[]> {
		let templateText = key
		if (this.config !== undefined) {
			const value: Message | Messages | undefined = lodash.get(this.config.message, key)
			if (typeof value === 'string') {
				templateText = value
			} else if (value instanceof Array) {
				const picked = utils.randomPick<string | { text: string }>(value)

				if (typeof picked === 'string') {
					templateText = picked
				}

				if (picked instanceof Object) {
					templateText = picked.text
				}
			}
		}

		if (!this.templateCache.has(templateText)) {
			this.templateCache.set(templateText, lodash.template(templateText))
		}
		const compiledTemplate = this.templateCache.get(templateText) ?? utils.unreachable()
		let text = compiledTemplate(args)
		if ('guild' in channel) {
			text = utils.replaceEmoji(text, channel.guild.emojis)
		}
		return await channel.send({ content: text, ...options })
	}

	get defaultObjectStorage(): ObjectStorage {
		return this.#defaultObjectStorage
	}
}
