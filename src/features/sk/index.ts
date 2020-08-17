import * as discordjs from 'discord.js'

import { Command } from 'Src/features/command'
import CommonFeatureBase from 'Src/features/common-feature-base'
import { StorageType, StorageDriver } from '../storage'
import * as utils from 'Src/utils'

class SetSkCommand implements Command {
	constructor(private readonly cmdName: string, private readonly storageDriver: StorageDriver) { }

	name(): string {
		return this.cmdName
	}

	description(): string {
		return '!sk の内容を設定'
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		if (args.length < 2) {
			await msg.reply('引数の数isダメ')
			return
		}
		const nb = parseInt(args[0], 10)
		if (isNaN(nb)) {
			await msg.reply('第一引数が数じゃない')
			return
		}

		const map = this.storageDriver.channel(msg).get<Map<number, string[]>>('sk')
		const skmsgs = args.splice(1)
		map.set(nb, skmsgs)
		await msg.reply('skを設定したよ: ' + skmsgs.join(','))
	}
}

export class FeatureSk extends CommonFeatureBase {
	private skRegExp: RegExp

	constructor(private readonly skCmdName: string, private readonly setCmdName: string) {
		super()
		this.skRegExp = new RegExp(`${skCmdName}(\\d+)`, 'g')
	}

	initImpl(): Promise<void> {
		this.storageDriver.setChannelStorageConstructor(() => new StorageType(new Map<string, any>([['sk', new Map<number, string[]>()]])))
		this.featureCommand.registerCommand(new SetSkCommand(this.setCmdName, this.storageDriver))
		return Promise.resolve()
	}

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		if (msg.content.includes(this.skCmdName)) {
			const picked = new Map<number, string>()

			await msg.reply(msg.content.replace(this.skRegExp, (match, strnb) => {
				const nb = parseInt(strnb, 10)
				let res = picked.get(nb)
				if (res === undefined) {
					res = match
					const map = this.storageDriver.channel(msg).get<Map<number, string[]>>('sk')
					const arr = map.get(nb)
					if (arr !== undefined) {
						res = utils.randomPick(arr)
						picked.set(nb, res)
					}
				}
				return res
			}))
		}
	}
}
