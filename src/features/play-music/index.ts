import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import * as utils from 'Src/utils'

import { MusicDatabase } from 'Src/features/play-music/music-database'
import { GuildInstance } from 'Src/features/play-music/guild-instance'
import { adaptContext } from 'Src/rpc/server'
import { playMusicServer } from 'Src/features/play-music/rpc-server'

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
		const feature = this.feature
		const guildInstance = this.feature.getGuildInstance(msg.guild)
		await utils.subCommandProxy(
			{
				async play(a, m) {
					await guildInstance.playCommand(a, m)
				},
				async add(a, m) {
					await guildInstance.addCommand(a, m)
				},
				stop() {
					guildInstance.stop()
					return Promise.resolve()
				},
				async reload() {
					await feature.reload()
				},
				async next(a, m) {
					await guildInstance.nextCommand(a, m)
				},
				async edit(a, m) {
					await guildInstance.edit(a, m)
				},
				async now(a, m) {
					await guildInstance.nowPlaying(a, m)
				},
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

		const webApiServer2 = this.featureWebApiServer2
		if (webApiServer2 !== undefined) {
			webApiServer2.registerRpcServer(
				adaptContext(playMusicServer)((orig) => {
					return {
						...orig,
						feature: this,
						guildInstance: this.getGuildInstance(orig.guild),
					}
				})
			)
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
