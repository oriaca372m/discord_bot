import { promises as fs } from 'fs'
import axios from 'axios'
import TOML from '@iarna/toml'
import * as discordjs from 'discord.js'

import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'
import { CustomReply } from 'src/features/custom-reply'

function validateParsedConfig(_config: unknown): _config is ReplyConfig {
	// TODO: バリデーション実施。ダメな時は false を返す
	return true
}

function isValidId(id: string): boolean {
	const validIdRegExp = /^[a-zA-Z1-9-_]{2,32}$/
	return validIdRegExp.test(id)
}

export type Response = {
	action?: string
	text?: string
	pattern?: string
	image?: string
	reply?: boolean
}

export type ReplyConfig = {
	contents: {
		target: string
		responses: Response | Response[]
	}[]
}

type ConfigSource = {
	source: string
	format: 'toml'
}

export class Config {
	public readonly config = new Map<string, ReplyConfig>()
	private readonly configSources = new Map<string, ConfigSource>()
	private readonly configTexts = new Map<string, string>()

	constructor(
		private readonly channelInstance: CustomReply,
		private readonly gc: FeatureGlobalConfig
	) {}

	getConifgIds(): string[] {
		return [...this.configSources.keys()]
	}

	getConifg(id: string): string | undefined {
		return this.configTexts.get(id)
	}

	async setConifg(id: string, text: string, writeToFile = true): Promise<string | undefined> {
		if (!this.configSources.has(id)) {
			throw new Error(`undefined id: ${id}`)
		}

		let parsed
		try {
			parsed = await TOML.parse.async(text)
		} catch (e) {
			if (e instanceof Error) {
				return e.message
			}
			throw e
		}

		if (!validateParsedConfig(parsed)) {
			return '不正なフォーマットです。'
		}

		this.config.set(id, parsed)
		this.configTexts.set(id, text)
		if (writeToFile) {
			await fs.writeFile(this._configFilePath(id), text)
		}
		return
	}

	private _configFilePath(id: string): string {
		return `./config/custom-reply/${this.channelInstance.channel.id}/${id}.dat`
	}

	private async updateConfig(id: string, viaInternet = false): Promise<void> {
		const source = this.configSources.get(id)
		if (source === undefined) {
			throw new Error(`undefined id: ${id}`)
		}

		let text
		if (viaInternet) {
			const req = await axios(`${source.source}?${Math.random()}`)
			const data = req.data as unknown
			if (typeof data !== 'string') {
				throw new Error(`invalid response type: ${id}`)
			}
			text = data
		} else {
			text = await fs.readFile(this._configFilePath(id), 'utf-8')
		}

		if ((await this.setConifg(id, text, viaInternet)) !== undefined) {
			throw new Error(`invalid config file: ${id}`)
		}
	}

	async init(): Promise<void> {
		await fs.mkdir(`./config/custom-reply/${this.channelInstance.channel.id}/images`, {
			recursive: true,
		})

		let json
		try {
			json = await fs.readFile(
				`./config/custom-reply/${this.channelInstance.channel.id}/sources.json`,
				'utf-8'
			)
		} catch (_) {
			return
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const parsed = JSON.parse(json)
		for (const [k, v] of parsed) {
			this.configSources.set(k, v)
		}

		for (const id of this.configSources.keys()) {
			try {
				await this.updateConfig(id)
			} catch (e) {
				console.error(e)
				continue
			}
		}
	}

	private async reloadLocalCommand(args: string[], msg: discordjs.Message): Promise<void> {
		for (const id of this.configSources.keys()) {
			try {
				await this.updateConfig(id)
			} catch (e) {
				console.error(e)
				await this.gc.send(msg, 'customReply.config.errorOnReloading', {
					id,
				})
				continue
			}
		}
		await this.gc.send(msg, 'customReply.config.localReloadingComplete')
	}

	private async reloadCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (args.length < 1) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyId')
			return
		}

		const id = args[0]

		if (!this.configSources.has(id)) {
			await this.gc.send(msg, 'customReply.config.idThatDoesNotExist')
			return
		}

		try {
			await this.updateConfig(id, true)
		} catch (e) {
			console.error(e)
			await this.gc.send(msg, 'customReply.config.errorOnReloading', {
				id,
			})
			return
		}

		await this.gc.send(msg, 'customReply.config.reloadingComplete', { id })
	}

	async writeSourcesJson(): Promise<void> {
		await fs.writeFile(
			`./config/custom-reply/${this.channelInstance.channel.id}/sources.json`,
			JSON.stringify([...this.configSources])
		)
	}

	private async addCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (args.length < 2) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyIdAndUrl')
			return
		}

		const [id, url] = args

		if (!isValidId(id)) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyValidId')
			return
		}

		if (!utils.isValidUrl(url)) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyValidUrl')
			return
		}

		this.configSources.set(id, { source: url, format: 'toml' })
		await this.updateConfig(id, true)
		await this.writeSourcesJson()

		await this.gc.send(msg, 'customReply.config.addingComplete', { id })
	}

	private async listCommand(args: string[], msg: discordjs.Message): Promise<void> {
		await this.gc.send(msg, 'customReply.config.list', {
			sources: [...this.configSources].map(([k, v]) => `${k}: ${v.source}`).join('\n'),
		})
	}

	private async removeCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (args.length < 1) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyId')
			return
		}

		const id = args[0]

		if (!this.configSources.has(id)) {
			await this.gc.send(msg, 'customReply.config.idThatDoesNotExist')
			return
		}

		this.config.delete(id)
		this.configSources.delete(id)
		this.configTexts.delete(id)
		await this.writeSourcesJson()

		await this.gc.send(msg, 'customReply.config.removingComplete', { id })
	}

	async command(args: string[], msg: discordjs.Message): Promise<void> {
		await utils.subCommandProxy(
			{
				reload: (a, m) => this.reloadCommand(a, m),
				reloadlocal: (a, m) => this.reloadLocalCommand(a, m),
				add: (a, m) => this.addCommand(a, m),
				list: (a, m) => this.listCommand(a, m),
				remove: (a, m) => this.removeCommand(a, m),
			},
			args,
			msg
		)
	}
}
