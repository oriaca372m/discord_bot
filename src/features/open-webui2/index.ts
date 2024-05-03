import type * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import type { Command } from 'Src/features/command'
import { URL } from 'node:url'
import * as u from 'Src/utils'

export class FeatureOpenWebui2 extends CommonFeatureBase implements Command {
	#externalApiUrl!: () => Promise<string>
	#localApiUrl!: string

	constructor(
		private readonly cmdName: string,
		private readonly webuiUrl: string,
		private readonly apiUrl: string | undefined
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
		u.mustExist(this.featureWebApiServer2)
		const port = this.featureWebApiServer2.port

		this.#externalApiUrl = u.lazyValue(
			async () => this.apiUrl ?? `http://${await u.getGlobalIpAddr()}:${port}/`
		)
		this.#localApiUrl = `http://127.0.0.1:${port}/`
		this.featureCommand.registerCommand(this)
		return Promise.resolve()
	}

	name(): string {
		return this.cmdName
	}

	description(): string {
		return 'WEB UIを開く'
	}

	async command(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		u.mustExist(this.featureWebApiServer2)

		let options
		try {
			;({ options } = u.parseCommandArgs(rawArgs, [], 0))
		} catch (e) {
			await msg.reply('コマンドのパースに失敗しました')
			return
		}

		if (msg.guild === null) {
			await msg.reply('サーバーでのみ有効なコマンドです')
			return
		}

		const accessToken = this.featureWebApiServer2.createAccessToken({
			channel: msg.channel,
			guild: msg.guild,
		}).basicInfo.accessToken

		const url = new URL(this.webuiUrl)

		const apiUrl = u.getOption(options, ['l', 'local', 'localhost'])
			? this.#localApiUrl
			: await this.#externalApiUrl()
		url.hash = encodeURIComponent(JSON.stringify({ server: apiUrl, accessToken }))

		await msg.reply(url.toString())
	}
}
