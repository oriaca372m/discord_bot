import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import * as utils from 'Src/utils'

import { MusicDatabase } from 'Src/features/play-music/music-database'
import { GuildInstance } from 'Src/features/play-music/guild-instance'
import { allHandlers } from 'Src/features/play-music/webapi-handlers'

class PlayMusicCommand implements Command {
	constructor(
		private readonly cmdName: string,
		private readonly feature: FeaturePlayMusic
	) {}

	name(): string {
		return this.cmdName
	}

	description(): string {
		return '音楽再生'
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		if (msg.guild === null) {
			return
		}
		const guildInstance = this.feature.getGuildInstance(msg.guild)
		await utils.subCommandProxy(
			{
				play: async (a, m) => await guildInstance.playCommand(a, m),
				add: async (a, m) => await guildInstance.addCommand(a, m),
				stop: () => {
					guildInstance.stop()
					return Promise.resolve()
				},
				reload: async () => await this.feature.reload(),
				next: async (a, m) => await guildInstance.nextCommand(a, m),
				edit: async (a, m) => await guildInstance.edit(a, m),
				now: async (a, m) => await guildInstance.nowPlaying(a, m),
			},
			args,
			msg
		)
	}
}

export class FeaturePlayMusic extends CommonFeatureBase {
	#database: MusicDatabase | undefined
	#guildInstances: Map<string, GuildInstance> = new Map()

	currentPlayingTrack: number | undefined

	constructor(
		public readonly cmdname: string,
		readonly youtubeApiKey?: string
	) {
		super()
	}

	get database(): MusicDatabase {
		utils.mustExist(this.#database)
		return this.#database
	}

	protected override async initImpl(): Promise<void> {
		await this.reload()
		this.featureCommand.registerCommand(new PlayMusicCommand(this.cmdname, this))

		const webApi = this.featureWebApi
		if (webApi === undefined) {
			return
		}

		for (const handler of allHandlers) {
			webApi.registerHandler(new handler(this))
		}
	}

	getGuildInstance(guild: discordjs.Guild): GuildInstance {
		const instance = this.#guildInstances.get(guild.id)
		if (instance !== undefined) {
			return instance
		}

		const newInstance = new GuildInstance(this)
		this.#guildInstances.set(guild.id, newInstance)
		return newInstance
	}

	protected override async onMessageImpl(msg: discordjs.Message): Promise<void> {
		if (msg.guild === null) {
			return
		}
		await this.getGuildInstance(msg.guild).onMessage(msg)
	}

	override async finalize(): Promise<void> {
		await Promise.allSettled(Array.from(this.#guildInstances.values()).map((x) => x.finalize()))
	}

	async reload(): Promise<void> {
		const database = new MusicDatabase('./config/playlists')
		await database.init()
		this.#database = database
	}
}
