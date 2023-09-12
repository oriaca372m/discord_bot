import * as discordjs from 'discord.js'
import * as voice from '@discordjs/voice'

import { FeatureGlobalConfig } from 'Src/features/global-config'
import { TypedEvent } from 'Src/typed-event'
import * as utils from 'Src/utils'

import { FeaturePlayMusic } from 'Src/features/play-music/'
import { MusicPlayResource } from 'Src/features/play-music/music'
import { MusicAdder } from 'Src/features/play-music/music-adder'
import { Playlist } from 'Src/features/play-music/playlist'
import { AddInteractor } from 'Src/features/play-music/interactor/interactor'

class ConnectionManager {
	#connection: voice.VoiceConnection | undefined
	#player: voice.AudioPlayer | undefined
	#musicPlayResource: MusicPlayResource | undefined

	readonly onMusicStopped = new TypedEvent<void>()
	readonly onError = new TypedEvent<voice.AudioPlayerError>()

	async connect(channel: discordjs.BaseGuildVoiceChannel): Promise<void> {
		if (this.hasConnectionTo(channel)) {
			this.stop()
			return
		} else {
			await this.disconnect()
		}

		const conn = voice.joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guild.id,
			adapterCreator: channel.guild.voiceAdapterCreator,
		})

		try {
			await voice.entersState(conn, voice.VoiceConnectionStatus.Ready, 30e3)
			this.#connection = conn
			this.#player = this.#createPlayer()
			this.#connection.subscribe(this.#player)
		} catch (e) {
			this.#destroyConnection()
			throw e
		}
	}

	play(res: MusicPlayResource): void {
		if (this.#connection === undefined || this.#player === undefined) {
			throw new Error('接続中のコネクションがない')
		}

		this.stop()

		this.#musicPlayResource = res
		this.#player.play(this.#musicPlayResource.audioResource)
	}

	stop(): void {
		this.#player?.stop()

		if (this.#musicPlayResource === undefined) {
			return
		}

		// TODO: finalizerとdestoryの呼び出し順序がこれでいいのか調べる
		if (this.#musicPlayResource.finalizer !== undefined) {
			this.#musicPlayResource.finalizer()
		}
		this.#musicPlayResource.audioResource.playStream.destroy()
	}

	async disconnect(): Promise<void> {
		this.stop()
		if (this.#connection !== undefined) {
			this.#destroyConnection()
			// 入れないと次のコネクションの作成がタイムアウトする
			// 1秒で十分かどうかは知らない
			await utils.delay(1000)
		}
	}

	get hasConnection(): boolean {
		return this.#connection !== undefined
	}

	hasConnectionTo(channel: discordjs.BaseGuildVoiceChannel): boolean {
		return (
			this.#connection !== undefined && channel.id === this.#connection.joinConfig.channelId
		)
	}

	#destroyConnection(): void {
		this.#player?.stop()
		this.#player = undefined

		this.#connection?.destroy()
		this.#connection = undefined
	}

	#createPlayer(): voice.AudioPlayer {
		const player = voice.createAudioPlayer()

		player.on(voice.AudioPlayerStatus.Idle, () => {
			this.stop()
			this.onMusicStopped.emit()
		})

		player.on('error', (error) => {
			this.stop()
			this.onError.emit(error)
		})

		return player
	}
}

export class GuildInstance {
	readonly #connectionManager = new ConnectionManager()
	readonly playlist: Playlist = new Playlist()

	readonly #interactors: Set<AddInteractor> = new Set()
	readonly #gc: FeatureGlobalConfig

	constructor(readonly feature: FeaturePlayMusic) {
		this.#gc = feature.gc
		this.#connectionManager.onMusicStopped.on(() => {
			this.next().catch((e) => console.error(e))
		})
		this.#connectionManager.onError.on((e) => console.log(e))
	}

	async play(
		channel: discordjs.BaseGuildVoiceChannel,
		reuseCurrentConnection = true
	): Promise<void> {
		if (!(reuseCurrentConnection && this.#connectionManager.hasConnectionTo(channel))) {
			await this.#connectionManager.connect(channel)
		}
		this.#playCurrentMusic()
	}

	async next(): Promise<void> {
		if (!this.#connectionManager.hasConnection) {
			return
		}

		if (this.playlist.isEmpty) {
			await this.#connectionManager.disconnect()
			return
		}

		this.playlist.next()
		this.#playCurrentMusic()
	}

	async stop(): Promise<void> {
		await this.#connectionManager.disconnect()
	}

	#playCurrentMusic(): void {
		if (this.playlist.currentMusic === undefined) {
			throw new Error('再生するべき曲が無い')
		}

		this.#connectionManager.play(this.playlist.currentMusic.createResource())
	}

	async finalize(): Promise<void> {
		await this.#connectionManager.disconnect()
	}

	get #isInInteractionMode(): boolean {
		return this.#interactors.size !== 0
	}

	#createInteractor(msg: discordjs.Message): AddInteractor {
		const i = new AddInteractor(this, msg.channel, this.playlist, () => {
			this.#interactors.delete(i)
		})
		this.#interactors.add(i)

		return i
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		for (const i of this.#interactors) {
			await i.onMessage(msg)
		}
	}

	async edit(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args
		try {
			;({ args } = utils.parseCommandArgs(rawArgs, [], 0))
		} catch (e) {
			await this.#gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		if (1 < args.length) {
			await msg.reply('駄目なメッセージの引数の数')
			return
		}

		if (this.#isInInteractionMode) {
			await msg.reply('今まさにインタラクションモード')
			return
		}

		const i = this.#createInteractor(msg)
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
