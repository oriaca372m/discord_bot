import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { FeatureGlobalConfig } from 'Src/features/global-config'
import { FeatureWebApi } from 'Src/features/webapi'
import * as utils from 'Src/utils'

import { Playlist } from 'Src/features/play-music/playlist'
import { MusicDatabase } from 'Src/features/play-music/music-database'
import { MusicAdder } from 'Src/features/play-music/music-adder'
import { AddInteractor } from 'Src/features/play-music/interactor/interactor'
import * as handlers from 'Src/features/play-music/webapi-handlers'

class PlayMusicCommand implements Command {
	private readonly gc: FeatureGlobalConfig

	constructor(private readonly cmdName: string, private readonly feature: FeaturePlayMusic) {
		this.gc = this.feature.gc
	}

	name(): string {
		return this.cmdName
	}

	description(): string {
		return '音楽再生'
	}

	async edit(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args
		try {
			;({ args } = utils.parseCommandArgs(rawArgs, [], 0))
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			await this.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		if (1 < args.length) {
			await msg.reply('駄目なメッセージの引数の数')
			return
		}

		if (this.feature.isInInteractionMode) {
			await msg.reply('今まさにインタラクションモード')
			return
		}

		const i = this.feature.createInteractor(msg)
		await i.welcome()
		if (args.length === 1) {
			await i.search(args[0])
		}
		return
	}

	async now(_rawArgs: string[], msg: discordjs.Message): Promise<void> {
		const music = this.feature.playlist.currentMusic
		if (music === undefined) {
			await msg.reply('今流れている曲は無いよ…')
		} else {
			const title = music.getTitle()
			await msg.reply('今流れている曲はこれだよ！' + title)
		}
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
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
				stop: async () => {
					await this.feature.closeConnection()
				},
				reload: async () => {
					await this.feature.reload()
				},
				next: async () => {
					await this.feature.next()
				},
				edit: async (a, m) => {
					await this.edit(a, m)
				},
				now: async (a, m) => {
					await this.now(a, m)
				},
			},
			args,
			msg
		)
	}
}

export class FeaturePlayMusic extends CommonFeatureBase {
	private readonly interactors: Set<AddInteractor> = new Set()
	private connection: discordjs.VoiceConnection | undefined
	private dispatcher: discordjs.StreamDispatcher | undefined
	private musicFinalizer: (() => void) | undefined
	private _database!: MusicDatabase

	readonly playlist: Playlist = new Playlist()
	currentPlayingTrack: number | undefined

	constructor(public readonly cmdname: string) {
		super()
	}

	get database(): MusicDatabase {
		return this._database
	}

	protected async initImpl(): Promise<void> {
		await this.reload()
		this.featureCommand.registerCommand(new PlayMusicCommand(this.cmdname, this))

		const featureWebApi = this.manager.getFeature<FeatureWebApi>('webapi')
		if (featureWebApi === undefined) {
			return
		}

		featureWebApi.registerHandler(new handlers.GetAllMusics(this))
		featureWebApi.registerHandler(new handlers.AddToPlaylist(this))
		featureWebApi.registerHandler(new handlers.GetPlaylist(this))
	}

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		for (const i of this.interactors) {
			await i.onMessage(msg)
		}
	}

	createInteractor(msg: discordjs.Message): AddInteractor {
		const i = new AddInteractor(msg.channel, this, this.playlist, () => {
			this.interactors.delete(i)
		})
		this.interactors.add(i)

		return i
	}

	async reload(): Promise<void> {
		const database = new MusicDatabase('./config/playlists')
		await database.init()
		this._database = database
	}

	play(): Promise<void> {
		if (this.connection === undefined) {
			throw '接続中のコネクションがない'
		}

		const music = this.playlist.currentMusic
		if (!music) {
			throw '流すべき曲がない'
		}

		this.destroyDispather()

		{
			const [dispatcher, finalizer] = music.createDispatcher(this.connection)
			this.dispatcher = dispatcher
			this.musicFinalizer = finalizer
		}

		this.dispatcher.on('finish', () => {
			void this.next()
		})

		this.dispatcher.on('error', (error) => {
			console.error(error)
			this.destroyDispather()

			// TODO: どうにかしてテキストチャンネルに通知を送りたい所
		})

		return Promise.resolve()
	}

	async next(): Promise<void> {
		this.destroyDispather()
		if (this.connection === undefined) {
			return
		}

		if (this.playlist.isEmpty) {
			return
		}

		this.playlist.next()
		await this.play()
	}

	async playMusicEditingPlaylist(
		msg: discordjs.Message,
		playlistEditor: (playlist: Playlist) => Promise<void>
	): Promise<void> {
		const member = msg.member
		if (!member) {
			return
		}

		if (!member.voice.channel) {
			await this.gc.send(msg, 'playMusic.haveToJoinVoiceChannel')
			return
		}

		await playlistEditor(this.playlist)

		await this.makeConnection(member.voice.channel)
		await this.play()
	}

	destroyDispather(): void {
		this.dispatcher?.destroy()
		this.dispatcher = undefined

		if (this.musicFinalizer !== undefined) {
			this.musicFinalizer()
		}
	}

	async closeConnection(): Promise<void> {
		this.destroyDispather()
		if (this.connection !== undefined) {
			this.connection.disconnect()
			this.connection = undefined
			// 入れないと次のコネクションの作成がタイムアウトする
			// 1秒で十分かどうかは知らない
			await utils.delay(1000)
		}
	}

	async makeConnection(channel: discordjs.VoiceChannel): Promise<void> {
		if (this.connection !== undefined && channel.id === this.connection.channel.id) {
			this.destroyDispather()
		} else {
			await this.closeConnection()
		}
		this.connection = await channel.join()
	}

	async finalize(): Promise<void> {
		await this.closeConnection()
	}

	get isInInteractionMode(): boolean {
		return this.interactors.size !== 0
	}
}
