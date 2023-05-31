import * as discordjs from 'discord.js'
import * as utils from 'Src/utils'

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

	async command(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		let options
		try {
			;({ options } = utils.parseCommandArgs(rawArgs, [], 0))
		} catch (e) {
			await msg.reply('コマンドのパースに失敗しました')
			return
		}

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

		let apiUrl =
			this._feature.apiUrl ??
			`http://${this._feature.globalIpAddr ?? utils.unreachable()}:${
				this._feature.featureWebApi.port
			}/`
		if (utils.getOption(options, ['l', 'local', 'localhost'])) {
			apiUrl = `http://127.0.0.1:${this._feature.featureWebApi.port}/`
		}
		url.searchParams.append('server', apiUrl)
		url.searchParams.append('accessToken', token)
		url.searchParams.append('accessTokenSecret', secret)

		await msg.reply(url.toString())
	}
}

async function getGlobalIpAddr(): Promise<string> {
	const res = await fetch('https://ipinfo.io/ip')
	const text = await res.text()
	if (!res.ok) {
		throw new Error(`Failed to get ip address: ${text}`)
	}
	return text
}

export class FeatureBasicWebApiMethods extends CommonFeatureBase {
	featureWebApi!: FeatureWebApi
	globalIpAddr: string | undefined

	constructor(
		public readonly webuiCmdName: string,
		public readonly webuiUrl: string,
		public readonly apiUrl: string | undefined
	) {
		super()
	}

	preInitImpl(): void {
		super.preInitImpl()
		if (this.featureWebApi === undefined) {
			throw 'webapiにFeatureWebApiがセットされていない'
		}
	}

	async initImpl(): Promise<void> {
		this.featureWebApi.registerHandler(new Handler())

		this.featureCommand.registerCommand(new CommandOpenWebUi(this))

		if (this.apiUrl === undefined) {
			this.globalIpAddr = await getGlobalIpAddr()
		}
	}
}
