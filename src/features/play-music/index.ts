import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'

import { MusicDatabase } from 'Src/features/play-music/music-database'
import { MusicAdder } from 'Src/features/play-music/music-adder'
import { GuildInstance } from 'Src/features/play-music/guild-instance'
import * as handlers from 'Src/features/play-music/webapi-handlers'

class PlayMusicCommand implements Command {
	private readonly gc: FeatureGlobalConfig

	constructor(
		private readonly cmdName: string,
		private readonly feature: FeaturePlayMusic
	) {
		this.gc = this.feature.gc
	}

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
				play: async (a, m) => {
					const adder = new MusicAdder(this.feature, undefined, true)
					await adder.play(m, a)
				},
				add: async (a, m) => {
					const adder = new MusicAdder(this.feature)
					await adder.add(m, a)
				},
				stop: async () => await guildInstance.closeConnection(),
				reload: async () => await this.feature.reload(),
				next: async () => await guildInstance.next(),
				edit: async (a, m) => await guildInstance.edit(a, m),
				now: async (a, m) => await guildInstance.nowPlaying(a, m),
			},
			args,
			msg
		)
	}
}

export class FeaturePlayMusic extends CommonFeatureBase {
	private _database!: MusicDatabase
	#guildInstances: Map<string, GuildInstance> = new Map()

	currentPlayingTrack: number | undefined

	constructor(
		public readonly cmdname: string,
		readonly youtubeApiKey?: string
	) {
		super()
	}

	get database(): MusicDatabase {
		return this._database
	}

	protected async initImpl(): Promise<void> {
		await this.reload()
		this.featureCommand.registerCommand(new PlayMusicCommand(this.cmdname, this))

		const webApi = this.featureWebApi
		if (webApi === undefined) {
			return
		}

		webApi.registerHandler(new handlers.GetAllMusics(this))
		webApi.registerHandler(new handlers.AddToPlaylist(this))
		webApi.registerHandler(new handlers.AddUrlToPlaylist(this))
		webApi.registerHandler(new handlers.GetPlaylist(this))
		webApi.registerHandler(new handlers.SetPlaylist(this))
		webApi.registerHandler(new handlers.Play(this))
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

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		if (msg.guild === null) {
			return
		}
		await this.getGuildInstance(msg.guild).onMessage(msg)
	}

	async reload(): Promise<void> {
		const database = new MusicDatabase('./config/playlists')
		await database.init()
		this._database = database
	}
}
