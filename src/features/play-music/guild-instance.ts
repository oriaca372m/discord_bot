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

class Connection {
	#connection: voice.VoiceConnection | undefined
	#player: voice.AudioPlayer | undefined

	#musicPlayResource: MusicPlayResource | undefined
	#finalizeCalled = false

	readonly onMusicStopped = new TypedEvent<void>()
	readonly onError = new TypedEvent<voice.AudioPlayerError>()

	constructor(readonly channel: discordjs.BaseGuildVoiceChannel) {}

	async init(): Promise<void> {
		await utils.retry(() => this.#connectInternal(this.channel), 3, {
			logging: true,
			waitMs: 1000,
		})

		if (this.#finalizeCalled) {
			this.finalize()
			return
		}

		if (this.#musicPlayResource !== undefined) {
			utils.mustExist(this.#player)
			this.#player.play(this.#musicPlayResource.audioResource)
		}
	}

	finalize(): void {
		this.stop()
		this.#connection?.destroy()
		this.#finalizeCalled = true
	}

	async #connectInternal(channel: discordjs.BaseGuildVoiceChannel): Promise<void> {
		const conn = voice.joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guild.id,
			adapterCreator: channel.guild.voiceAdapterCreator,
		})

		try {
			await voice.entersState(conn, voice.VoiceConnectionStatus.Ready, 30e3)
			const player = this.#createPlayer()
			conn.subscribe(player)

			this.#connection = conn
			this.#player = player
		} catch (e) {
			conn.destroy()
			throw e
		}
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

	play(res: MusicPlayResource): void {
		this.stop()

		if (this.#player === undefined) {
			this.#musicPlayResource = res
			return
		}

		this.#musicPlayResource = res
		this.#player.play(this.#musicPlayResource.audioResource)
	}

	stop(): void {
		this.#player?.stop()

		if (this.#musicPlayResource === undefined) {
			return
		}

		try {
			this.#musicPlayResource.audioResource.playStream.destroy()
			this.#musicPlayResource.finalizer?.()
		} finally {
			this.#musicPlayResource = undefined
		}
	}
}

export class GuildInstance {
	#connection: Connection | undefined
	readonly playlist: Playlist = new Playlist()

	readonly #interactors: Set<AddInteractor> = new Set()
	readonly #gc: FeatureGlobalConfig

	constructor(readonly feature: FeaturePlayMusic) {
		this.#gc = feature.gc
	}

	#connect(channel: discordjs.BaseGuildVoiceChannel): void {
		// TODO: エラーをユーザーに通知したい

		this.#connection = new Connection(channel)
		this.#connection.init().catch((e) => {
			console.error(e)
			this.stop()
		})

		this.#connection.onMusicStopped.on(() => this.next())
		this.#connection.onError.on(console.error)
	}

	playOn(channel: discordjs.BaseGuildVoiceChannel, reuseCurrentConnection = true): void {
		if (
			reuseCurrentConnection &&
			this.#connection !== undefined &&
			this.#connection.channel.equals(channel)
		) {
			this.#playCurrentMusic()
			return
		}

		this.stop()
		this.#connect(channel)
		this.#playCurrentMusic()
	}

	// 再生されたらtrue
	playIfHasConnection(): boolean {
		if (this.#connection === undefined) {
			return false
		}

		this.#playCurrentMusic()
		return true
	}

	next(): void {
		if (this.#connection === undefined) {
			return
		}

		if (this.playlist.isEmpty) {
			this.stop()
			return
		}

		this.playlist.next()
		this.#playCurrentMusic()
	}

	stop(): void {
		this.#connection?.finalize()
		this.#connection = undefined
	}

	#playCurrentMusic(): void {
		utils.mustExist(this.playlist.currentMusic)
		utils.mustExist(this.#connection)

		this.#connection.play(this.playlist.currentMusic.createResource())
	}

	async finalize(): Promise<void> {
		this.stop()
		return Promise.resolve()
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
