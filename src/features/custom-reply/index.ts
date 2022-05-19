import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { StorageType } from 'Src/features/storage'
import { FeatureGlobalConfig } from 'Src/features/global-config'

import * as utils from 'Src/utils'
import { Images } from 'Src/features/custom-reply/images'
import { Config, Response } from 'Src/features/custom-reply/config'
import * as handlers from 'Src/features/custom-reply/webapi-handlers'

import { Action } from 'Src/features/custom-reply/actions/action'
import { ActionGacha } from 'Src/features/custom-reply/actions/gacha'
import { ActionSenko } from 'Src/features/custom-reply/actions/senko'
import { ActionDefault } from 'Src/features/custom-reply/actions/default'
import { ActionDoNothing } from 'Src/features/custom-reply/actions/do-nothing'
import { ActionJakuraiClock } from 'Src/features/custom-reply/actions/jakurai-clock'

export class CustomReply {
	private initialized = false
	private readonly images: Images
	readonly config: Config
	private gc: FeatureGlobalConfig
	private readonly _actions: { [key: string]: Action }

	constructor(
		readonly feature: FeatureCustomReply,
		public readonly channel: utils.LikeTextChannel
	) {
		this.gc = feature.gc
		this.images = new Images(this.gc)
		this.config = new Config(this.gc)

		this._actions = {
			gacha: new ActionGacha(this.images, this.gc),
			senko: new ActionSenko(),
			['do-nothing']: new ActionDoNothing(),
			['jakurai-clock']: new ActionJakuraiClock(),
			default: new ActionDefault(this.images, this.gc),
		}
	}

	async init(): Promise<void> {
		const storage = await this.gc.defaultObjectStorage.cd(`custom-reply/${this.channel.id}`)
		await this.config.init(storage)
		await this.images.init(await storage.cd('images'))
		this.initialized = true
	}

	private async processPickedResponse(msg: discordjs.Message, response: Response): Promise<void> {
		const action = this._actions[response.action ?? ''] ?? this._actions.default
		const result = await action.handle(msg, response)

		if (result === undefined) {
			return
		}

		let text = result.text ?? ''
		if (msg.guild) {
			text = utils.replaceEmoji(text, msg.guild.emojis)
		}
		const options = { ...(result.options ?? {}), content: text }

		if (response.reply) {
			await msg.reply(options)
		} else {
			await msg.channel.send(options)
		}
	}

	async _processCustomResponse(msg: discordjs.Message): Promise<void> {
		let matches: Response[] = []
		for (const [, v] of this.config.config) {
			for (const content of v.contents) {
				if (new RegExp(content.target).test(msg.content)) {
					matches = matches.concat(content.responses)
				}
			}
		}

		if (0 < matches.length) {
			const response = utils.randomPick(matches)
			await this.processPickedResponse(msg, response)
		}
	}

	async onCommand(msg: discordjs.Message, args: string[]): Promise<void> {
		await utils.subCommandProxy(
			{
				config: (a, m) => this.config.command(a, m),
				images: (a, m) => this.images.command(a, m),
			},
			args,
			msg
		)
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		if (msg.author.bot) {
			return
		}

		while (!this.initialized) {
			// TODO: もっとマシな方法で待ちたい
			await utils.delay(100)
		}

		await this.images.processImageUpload(msg)
		await this._processCustomResponse(msg)
	}
}

class CustomReplyCommand implements Command {
	constructor(private readonly feature: FeatureCustomReply, private readonly cmdname: string) {}

	name(): string {
		return this.cmdname
	}

	description(): string {
		return 'custom-reply'
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		await this.feature.storageDriver
			.channel(msg)
			.get<CustomReply>('customReply')
			.onCommand(msg, args)
	}
}

export class FeatureCustomReply extends CommonFeatureBase {
	constructor(private readonly cmdname: string) {
		super()
	}

	async initImpl(): Promise<void> {
		this.storageDriver.setChannelStorageConstructor((ch) => {
			const client = new CustomReply(this, ch)
			void client.init()
			return new StorageType(new Map<string, unknown>([['customReply', client]]))
		})
		this.featureCommand.registerCommand(new CustomReplyCommand(this, this.cmdname))

		const webApi = this.featureWebApi
		if (webApi === undefined) {
			return Promise.resolve()
		}

		webApi.registerHandler(new handlers.GetConfigList(this))
		webApi.registerHandler(new handlers.GetConfig(this))
		webApi.registerHandler(new handlers.SetConfig(this))
		return Promise.resolve()
	}

	getChannelInstance(channel: utils.LikeTextChannel): CustomReply {
		return this.storageDriver.channelFromChannel(channel).get<CustomReply>('customReply')
	}

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		await this.storageDriver.channel(msg).get<CustomReply>('customReply').onMessage(msg)
	}
}
