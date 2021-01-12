import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { FeatureWebApi, WebApiHandler } from 'Src/features/webapi'
import { bufferToHex } from 'Src/features/webapi/utils'

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
class CommandOpenWebUi implements Command {
	constructor(private readonly _feature: FeatureBasicWebApiMethods) {}

	name(): string {
		return 'webui'
	}

	description(): string {
		return 'WEB UIを開く'
	}

	async command(msg: discordjs.Message): Promise<void> {
		if (msg.guild === null) {
			await msg.reply('サーバーでのみ有効なコマンドです')
			return
		}

		const info = this._feature.featureWebApi.createAccessToken({
			channel: msg.channel,
			guild: msg.guild,
		})

		const token = info.basicInfo.accessToken
		const secret = bufferToHex(info.basicInfo.accessTokenSecret)

		await msg.reply(
			`http://localhost:5000/?server=http://localhost:25565/&accessToken=${token}&accessTokenSecret=${secret}`
		)
	}
}

export class FeatureBasicWebApiMethods extends CommonFeatureBase {
	featureWebApi!: FeatureWebApi

	lastMessage: discordjs.Message | undefined

	preInitImpl(): void {
		super.preInitImpl()
		this.featureWebApi = this.manager.getFeature<FeatureWebApi>('webapi')
		if (this.featureWebApi === undefined) {
			throw 'webapiにFeatureWebApiがセットされていない'
		}
	}

	initImpl(): Promise<void> {
		this.featureWebApi.registerHandler(new Handler(this))

		this.featureCommand.registerCommand(new CommandOpenWebUi(this))

		return Promise.resolve()
	}

	onMessageImpl(msg: discordjs.Message): Promise<void> {
		this.lastMessage = msg
		return Promise.resolve()
	}
}
