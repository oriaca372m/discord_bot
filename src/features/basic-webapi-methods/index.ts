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
		private readonly externalApiUrl: () => Promise<string>,
		private readonly localApiUrl: string
	) {}

	name(): string {
		return this.cmdName
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

		const info = this.featureWebApi.createAccessToken({
			channel: msg.channel,
			guild: msg.guild,
		})

		const token = info.basicInfo.accessToken
		const secret = bufferToHex(info.basicInfo.accessTokenSecret)

		const url = new URL(this.webuiUrl)

		const apiUrl = utils.getOption(options, ['l', 'local', 'localhost'])
			? this.localApiUrl
			: await this.externalApiUrl()
		url.searchParams.append('server', apiUrl)
		url.searchParams.append('accessToken', token)
		url.searchParams.append('accessTokenSecret', secret)

		await msg.reply(url.toString())
	}
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

	initImpl(): Promise<void> {
		utils.mustExist(this.featureWebApi)

		this.featureWebApi.registerHandler(new Handler())

		const port = this.featureWebApi.port
		const externalApiUrl = utils.lazyValue(
			async () => this.apiUrl ?? `http://${await utils.getGlobalIpAddr()}:${port}/`
		)
		const localApiUrl = `http://127.0.0.1:${port}/`
		this.featureCommand.registerCommand(
			new CommandOpenWebUi(
				this.featureWebApi,
				this.webuiCmdName,
				this.webuiUrl,
				externalApiUrl,
				localApiUrl
			)
		)

		return Promise.resolve()
	}
}
