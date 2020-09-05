import * as discordjs from 'discord.js'

import { Command } from 'Src/features/command'
import CommonFeatureBase from 'Src/features/common-feature-base'
import { StorageType, StorageDriver } from '../storage'
import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'

type SkMessage = { message: string; weight: number }
type SkStore = Map<number, SkMessage[]>

class SetSkCommand implements Command {
	constructor(
		private readonly cmdName: string,
		private readonly storageDriver: StorageDriver,
		private readonly gc: FeatureGlobalConfig
	) {}

	name(): string {
		return this.cmdName
	}

	description(): string {
		return '!sk の内容を設定'
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		if (args.length < 2) {
			await this.gc.send(msg, 'sk.set.invalidCommand')
			return
		}

		const nbs = utils.parseIndexes(args[0].split(','), 1, 256)

		const skmsgs = args.splice(1).map((x) => {
			const res = /^(.+):(\d+)$/.exec(x)
			if (res !== null) {
				const nb = parseInt(res[2], 10)
				if (!isNaN(nb) && 0 < nb) {
					return { message: res[1], weight: nb }
				}
			}

			return { message: x, weight: 1 }
		})

		for (const nb of nbs) {
			const map = this.storageDriver.channel(msg).get<SkStore>('sk')
			map.set(nb, skmsgs)
		}
		await this.gc.send(msg, 'sk.set.set', { sk: skmsgs.map((x) => x.message).join(',') })
	}
}

export class FeatureSk extends CommonFeatureBase {
	private skRegExp: RegExp

	constructor(private readonly skCmdName: string, private readonly setCmdName: string) {
		super()
		this.skRegExp = new RegExp(`${skCmdName}(\\d+)`, 'g')
	}

	initImpl(): Promise<void> {
		this.storageDriver.setChannelStorageConstructor(
			() =>
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				new StorageType(
					new Map<string, any>([['sk', new Map<number, SkStore>()]])
				)
		)
		this.featureCommand.registerCommand(
			new SetSkCommand(this.setCmdName, this.storageDriver, this.gc)
		)
		return Promise.resolve()
	}

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		if (msg.content.includes(this.skCmdName)) {
			const picked = new Map<number, string>()

			await msg.reply(
				msg.content.replace(this.skRegExp, (match, strnb) => {
					const nb = parseInt(strnb, 10)
					let res = picked.get(nb)
					if (res === undefined) {
						res = match
						const map = this.storageDriver.channel(msg).get<SkStore>('sk')
						const arr = map.get(nb)
						if (arr !== undefined) {
							res = utils.randomPick(arr).message
							picked.set(nb, res)
						}
					}
					return res
				})
			)
		}
	}
}
