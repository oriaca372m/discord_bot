import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'

import { Playlist } from 'Src/features/play-music/playlist'
import { Music, YouTubeMusic } from 'Src/features/play-music/music'
import { MusicDatabase } from 'Src/features/play-music/music-database'
import { AddInteractor } from 'Src/features/play-music/interactor/interactor'

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

		if (this.feature.interactors.size !== 0) {
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

	async play(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args, options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, ['youtube'], 0))
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			await this.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		const member = msg.member
		if (!member) {
			return
		}

		if (!member.voice.channel) {
			await this.gc.send(msg, 'playMusic.haveToJoinVoiceChannel')
			return
		}

		if (args.length === 0) {
			if (this.feature.playlist.isEmpty) {
				await msg.reply('今はプレイリストが空ロボ')
				return
			}

			await this.feature.makeConnection(member.voice.channel)
			await this.feature.play()
			return
		}

		this.feature.playlist.clear()

		await this.feature.addToPlaylist(
			msg,
			args,
			utils.getOption(options, ['y', 'youtube']) as boolean
		)
		if (this.feature.playlist.isEmpty) {
			return
		}

		await this.feature.makeConnection(member.voice.channel)
		await this.feature.play()
	}

	async add(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args, options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, ['youtube'], 1))
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			await this.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		await this.feature.addToPlaylist(
			msg,
			args,
			utils.getOption(options, ['y', 'youtube']) as boolean
		)
	}

	async stop(): Promise<void> {
		await this.feature.closeConnection()
		this.feature.playlist.clear()
	}

	async reload(): Promise<void> {
		await this.feature.reload()
	}

	async next(): Promise<void> {
		await this.feature.next()
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
				play: (a, m) => this.play(a, m),
				add: (a, m) => this.add(a, m),
				stop: () => this.stop(),
				reload: () => this.reload(),
				edit: (a, m) => this.edit(a, m),
				next: () => this.next(),
				now: (a, m) => this.now(a, m),
			},
			args,
			msg
		)
	}
}

export class FeaturePlayMusic extends CommonFeatureBase {
	interactors: Set<AddInteractor> = new Set()
	private connection: discordjs.VoiceConnection | undefined
	private dispatcher: discordjs.StreamDispatcher | undefined
	private musicFinalizer: (() => void) | undefined
	database!: MusicDatabase

	playlist: Playlist = new Playlist()
	currentPlayingTrack: number | undefined

	constructor(public readonly cmdname: string) {
		super()
	}

	protected async initImpl(): Promise<void> {
		await this.reload()
		this.featureCommand.registerCommand(new PlayMusicCommand(this.cmdname, this))
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
		this.database = database
	}

	play(): Promise<void> {
		if (this.connection === undefined) {
			throw '接続中のコネクションがない'
		}

		const music = this.playlist.currentMusic
		if (!music) {
			throw 'だめ'
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
		return await this.play()
	}

	async addToPlaylist(
		msg: discordjs.Message,
		keywords: string[],
		isYouTube: boolean
	): Promise<void> {
		for (const keyword of keywords) {
			let music: Music | undefined

			if (isYouTube) {
				music = new YouTubeMusic(keyword)
			} else {
				music = this.database.search(keyword)[0]
			}

			if (music) {
				this.playlist.addMusic(music)
				await msg.reply(`${music.getTitle()} をプレイリストに追加するロボ!`)
			} else {
				await msg.reply('そんな曲は無いロボ')
			}
		}
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
}
