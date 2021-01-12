import * as discordjs from 'discord.js'

import { FeatureBase, FeatureEventResult } from 'Src/features/feature'
import { FeatureWebApi, WebApiHandler } from 'Src/features/webapi'

class Handler implements WebApiHandler {
	readonly methodName = 'reply'

	constructor(private readonly _feature: FeatureBasicWebApiMethods) {}

	async handle(rawArgs: unknown): Promise<unknown> {
		const args = rawArgs as { msg: string }

		const msg = this._feature.lastMessage
		if (msg === undefined) {
			return { error: 'This bot has not received any messages since running.' }
		}

		await msg.reply(args.msg)
		return { text: msg.content }
	}
}

export class FeatureBasicWebApiMethods extends FeatureBase {
	readonly priority = 0
	private _featureWebApi!: FeatureWebApi

	lastMessage: discordjs.Message | undefined

	preInitImpl(): void {
		this._featureWebApi = this.manager.getFeature<FeatureWebApi>('webapi')
		if (this._featureWebApi === undefined) {
			throw 'webapiにFeatureWebApiがセットされていない'
		}
	}

	initImpl(): Promise<void> {
		this._featureWebApi.registerHandler(new Handler(this))
		return Promise.resolve()
	}

	onMessage(msg: discordjs.Message): FeatureEventResult {
		this.lastMessage = msg
		return {}
	}
}
