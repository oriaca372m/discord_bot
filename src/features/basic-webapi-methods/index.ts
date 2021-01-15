import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { FeatureWebApi, WebApiHandler, AccessTokenInfo } from 'Src/features/webapi'
import { bufferToHex } from 'Src/features/webapi/utils'
import { URL } from 'url'

class Handler implements WebApiHandler {
	readonly methodName = 'sendToChannel'

	async handle(rawArgs: unknown, tokenInfo: AccessTokenInfo): Promise<unknown> {
		const args = rawArgs as { msg: string }

		await tokenInfo.channel.send(args.msg)
		return {}
	}
}

class CommandOpenWebUi implements Command {
	constructor(private readonly _feature: FeatureBasicWebApiMethods) {}

	name(): string {
		return this._feature.webuiCmdName
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

		const url = new URL(this._feature.webuiUrl)
		url.searchParams.append('server', `http://localhost:${this._feature.featureWebApi.port}/`)
		url.searchParams.append('accessToken', token)
		url.searchParams.append('accessTokenSecret', secret)

		await msg.reply(url.toString())
	}
}

export class FeatureBasicWebApiMethods extends CommonFeatureBase {
	featureWebApi!: FeatureWebApi

	lastMessage: discordjs.Message | undefined

	constructor(public readonly webuiCmdName: string, public readonly webuiUrl: string) {
		super()
	}

	preInitImpl(): void {
		super.preInitImpl()
		this.featureWebApi = this.manager.getFeature<FeatureWebApi>('webapi')
		if (this.featureWebApi === undefined) {
			throw 'webapiにFeatureWebApiがセットされていない'
		}
	}

	initImpl(): Promise<void> {
		this.featureWebApi.registerHandler(new Handler())

		this.featureCommand.registerCommand(new CommandOpenWebUi(this))

		return Promise.resolve()
	}

	onMessageImpl(msg: discordjs.Message): Promise<void> {
		this.lastMessage = msg
		return Promise.resolve()
	}
}
