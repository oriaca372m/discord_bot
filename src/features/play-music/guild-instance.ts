import * as discordjs from 'discord.js'
import * as voice from '@discordjs/voice'

import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'

import { FeaturePlayMusic } from 'Src/features/play-music/'
import { MusicAdder } from 'Src/features/play-music/music-adder'
import { Playlist } from 'Src/features/play-music/playlist'
import { AddInteractor } from 'Src/features/play-music/interactor/interactor'

export class GuildInstance {
	private connection: voice.VoiceConnection | undefined
	private player: voice.AudioPlayer | undefined
	#audioResource: voice.AudioResource | undefined
	private musicFinalizer: (() => void) | undefined
	private _isPlaying = false
	readonly playlist: Playlist = new Playlist()
	private readonly interactors: Set<AddInteractor> = new Set()
	private readonly gc: FeatureGlobalConfig

	constructor(readonly feature: FeaturePlayMusic) {
		this.gc = feature.gc
	}

	play(): Promise<void> {
		if (this.connection === undefined || this.player === undefined) {
			throw '接続中のコネクションがない'
		}

		const music = this.playlist.currentMusic
		if (!music) {
			throw '流すべき曲がない'
		}

		this.finalizeMusic()

		const [resource, finalizer] = music.createResource()
		this.#audioResource = resource
		this.musicFinalizer = finalizer
		this._isPlaying = true
		this.player.play(resource)

		return Promise.resolve()
	}

	async next(): Promise<void> {
		this.finalizeMusic()
		if (this.connection === undefined) {
			return
		}

		if (this.playlist.isEmpty) {
			await this.closeConnection()
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

	private finalizeMusic(): void {
		this._isPlaying = false
		this.player?.stop()

		if (this.musicFinalizer !== undefined) {
			this.musicFinalizer()
			this.musicFinalizer = undefined
		}

		if (this.#audioResource !== undefined) {
			this.#audioResource.playStream.destroy()
			this.#audioResource = undefined
		}
	}

	async closeConnection(): Promise<void> {
		this.finalizeMusic()
		if (this.connection !== undefined) {
			this.connection.destroy()
			this.connection = undefined
			this.player = undefined
			// 入れないと次のコネクションの作成がタイムアウトする
			// 1秒で十分かどうかは知らない
			await utils.delay(1000)
		}
	}

	private createPlayer(): voice.AudioPlayer {
		const player = voice.createAudioPlayer()

		player.on(voice.AudioPlayerStatus.Idle, () => {
			if (this._isPlaying) {
				void this.next()
			}
		})

		player.on('error', (error) => {
			console.error(error)
			this.finalizeMusic()

			// TODO: どうにかしてテキストチャンネルに通知を送りたい所
		})

		return player
	}

	async makeConnection(channel: discordjs.BaseGuildVoiceChannel): Promise<void> {
		if (this.connection !== undefined && channel.id === this.connection.joinConfig.channelId) {
			this.finalizeMusic()
			return
		} else {
			await this.closeConnection()
		}

		const conn = voice.joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guild.id,
			// https://github.com/discordjs/discord.js/issues/7884
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			adapterCreator: channel.guild.voiceAdapterCreator,
		})

		try {
			await voice.entersState(conn, voice.VoiceConnectionStatus.Ready, 30e3)
			this.connection = conn
			this.player = this.createPlayer()
			this.connection.subscribe(this.player)
		} catch (e) {
			conn.destroy()
			throw e
		}
	}

	async finalize(): Promise<void> {
		await this.closeConnection()
	}

	get isInInteractionMode(): boolean {
		return this.interactors.size !== 0
	}

	createInteractor(msg: discordjs.Message): AddInteractor {
		const i = new AddInteractor(this, msg.channel, this.playlist, () => {
			this.interactors.delete(i)
		})
		this.interactors.add(i)

		return i
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		for (const i of this.interactors) {
			await i.onMessage(msg)
		}
	}

	async edit(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args
		try {
			;({ args } = utils.parseCommandArgs(rawArgs, [], 0))
		} catch (e) {
			await this.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		if (1 < args.length) {
			await msg.reply('駄目なメッセージの引数の数')
			return
		}

		if (this.isInInteractionMode) {
			await msg.reply('今まさにインタラクションモード')
			return
		}

		const i = this.createInteractor(msg)
		await i.welcome()
		if (args.length === 1) {
			await i.search(args[0])
		}
		return
	}

	async nowPlaying(_rawArgs: string[], msg: discordjs.Message): Promise<void> {
		const music = this.playlist.currentMusic
		if (music === undefined) {
			await msg.reply('今流れている曲は無いよ…')
		} else {
			const title = music.getTitle()
			await msg.reply('今流れている曲はこれだよ！' + title)
		}
	}

	async playCommand(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		const adder = new MusicAdder(this, this.playlist, undefined, true)
		await adder.play(msg, rawArgs)
	}

	async addCommand(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		const adder = new MusicAdder(this, this.playlist)
		await adder.add(msg, rawArgs)
	}
}
