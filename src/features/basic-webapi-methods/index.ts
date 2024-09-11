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
	constructor(
		private readonly featureWebApi: FeatureWebApi,
		private readonly cmdName: string,
		private readonly webuiUrl: string,
		private readonly externalApiUrl: string,
		private readonly localApiUrl: string
	) {}

	name(): string {
		return this.cmdName
	}

	description(): string {
		return 'WEB UIを開く'
	}

	async command(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		let options: utils.Options
		try {
			;({ options } = utils.parseCommandArgs(rawArgs, [], 0))
		} catch (_) {
			await msg.reply('コマンドのパースに失敗しました')
			return
		}

		if (msg.guild === null) {
			await msg.reply('サーバーでのみ有効なコマンドです')
			return
		}

		const channel = msg.channel
		utils.mustSendableChannel(channel)
		const info = this.featureWebApi.createAccessToken({ channel, guild: msg.guild })

		const token = info.basicInfo.accessToken
		const secret = bufferToHex(info.basicInfo.accessTokenSecret)

		const url = new URL(this.webuiUrl)

		const apiUrl = utils.getOption(options, ['l', 'local', 'localhost'])
			? this.localApiUrl
			: this.externalApiUrl
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
			throw new Error('webapiにFeatureWebApiがセットされていない')
		}
	}

	async initImpl(): Promise<void> {
		utils.mustExist(this.featureWebApi)

		this.featureWebApi.registerHandler(new Handler())

		const externalApiUrl =
			this.apiUrl ?? `http://${await getGlobalIpAddr()}:${this.featureWebApi.port}/`
		const localApiUrl = `http://127.0.0.1:${this.featureWebApi.port}/`
		this.featureCommand.registerCommand(
			new CommandOpenWebUi(
				this.featureWebApi,
				this.webuiCmdName,
				this.webuiUrl,
				externalApiUrl,
				localApiUrl
			)
		)
	}
}
