import * as discordjs from 'discord.js'

import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'

import { FeaturePlayMusic } from 'Src/features/play-music'
import { GuildInstance } from 'Src/features/play-music/guild-instance'
import { Music } from 'Src/features/play-music/music'
import { YouTubeMusic, fetchPlaylistItems } from 'Src/features/play-music/youtube'
import { Playlist } from 'Src/features/play-music/playlist'
import { MusicDatabase } from 'Src/features/play-music/music-database'

interface CommandOptions {
	args: string[]
	isYouTube: boolean
	isAddToFirst: boolean
	isAddToNext: boolean
}

export async function resolveUrl(feature: FeaturePlayMusic, url: URL): Promise<Music[]> {
	if (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') {
		const params = url.searchParams
		const listId = params.get('list')
		if (listId !== null && !params.has('v')) {
			const apiKey = feature.youtubeApiKey
			if (apiKey === undefined) {
				throw new Error('YouTubeのAPIキーが指定されていません')
			}
			try {
				return await fetchPlaylistItems(apiKey, listId)
			} catch (e) {
				console.error('YouTubeのプレイリストの取得に失敗', e)
				return []
			}
		}
	}

	try {
		const ytMusic = new YouTubeMusic(url.toString())
		await ytMusic.init(feature.youtubeApiKey)
		return [ytMusic]
	} catch (e) {
		console.error('YouTubeの曲の初期化中にエラー', e)
		return []
	}
}

export class MusicAdder {
	readonly #gc: FeatureGlobalConfig
	readonly #database: MusicDatabase

	constructor(
		private readonly guildInstance: GuildInstance,
		private readonly playlist: Playlist,
		private readonly listMusics?: readonly Music[],
		private readonly resume: boolean = false
	) {
		this.#gc = guildInstance.feature.gc
		this.#database = guildInstance.feature.database
	}

	async #parseOptions(
		msg: discordjs.Message,
		rawArgs: string[]
	): Promise<CommandOptions | undefined> {
		let args: string[]
		let options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, []))
		} catch (e) {
			await this.#gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		const isYouTube = utils.getOption(options, ['y', 'youtube']) as boolean
		const isAddToFirst = utils.getOption(options, ['f', 'first']) as boolean
		const isAddToNext = utils.getOption(options, ['n', 'next']) as boolean

		if (isAddToFirst && isAddToNext) {
			await this.#gc.send(msg, 'playMusic.invalidCommand', {
				e: 'firstとnextを同時に指定することはできません',
			})
			return
		}

		return {
			args,
			isYouTube,
			isAddToFirst,
			isAddToNext,
		}
	}

	async #resolveMusicKeyword(keyword: string, isYouTube: boolean): Promise<Music[]> {
		const url = utils.tryEither(() => new URL(keyword))
		if (url.isOk()) {
			return resolveUrl(this.guildInstance.feature, url.value)
		}

		if (isYouTube) {
			throw new Error('YouTubeなのにurlじゃない')
		}

		const music = this.#database.search(keyword)[0]
		if (music !== undefined) {
			return [music]
		}

		return []
	}

	async #getMusics(keywords: string[], isYouTube: boolean): Promise<Music[]> {
		const musics: Music[] = []

		const listMusics = this.listMusics
		if (listMusics !== undefined) {
			const indexes = utils.tryEither(() =>
				utils.parseIndexes(keywords, 0, listMusics.length)
			)

			if (indexes.isOk()) {
				return indexes.value.map((x) => listMusics[x])
			}
		}

		for (const keyword of keywords) {
			const music = await this.#resolveMusicKeyword(keyword, isYouTube)
			if (music !== undefined) {
				musics.push(...music)
			}
		}

		return musics
	}

	#addMusicsToPlaylist(musics: readonly Music[], parseResult: CommandOptions): void {
		let counter = 0
		if (parseResult.isAddToNext) {
			const c = this.playlist.currentTrack
			if (c !== undefined) {
				counter = c + 1
			}
		}
		for (const music of musics) {
			if (parseResult.isAddToFirst || parseResult.isAddToNext) {
				this.playlist.addMusic(music, counter)
				counter++
			} else {
				this.playlist.addMusic(music)
			}
		}
	}

	async #addInternal(
		msg: discordjs.Message,
		parseResult: CommandOptions
	): Promise<readonly Music[]> {
		if (this.listMusics !== undefined && parseResult.args.length === 0) {
			this.#addMusicsToPlaylist(this.listMusics, parseResult)
			await this.#gc.send(msg, 'playMusic.interactor.addedMusic', {
				all: true,
				musics: [],
			})

			return this.listMusics
		}

		const toAddMusics = await this.#getMusics(parseResult.args, parseResult.isYouTube)
		this.#addMusicsToPlaylist(toAddMusics, parseResult)

		if (toAddMusics.length === 0) {
			await msg.reply('そんな曲は無いロボ…')
		} else if (toAddMusics.length <= 20) {
			await msg.reply(
				`プレイリストに追加したロボ!:\n${toAddMusics.map((x) => x.getTitle()).join('\n')}`
			)
		} else {
			const musicNames = toAddMusics
				.slice(0, 20)
				.map((x) => x.getTitle())
				.join('\n')
			await msg.reply(`${toAddMusics.length}件追加したロボ!:\n${musicNames}\netc...`)
		}

		return toAddMusics
	}

	async add(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		const parseResult = await this.#parseOptions(msg, rawArgs)
		if (parseResult === undefined) {
			return
		}

		await this.#addInternal(msg, parseResult)
	}

	async play(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		const parseResult = await this.#parseOptions(msg, rawArgs)
		if (parseResult === undefined) {
			return
		}

		const member = msg.member
		if (!member) {
			return
		}

		if (!member.voice.channel) {
			await this.#gc.send(msg, 'playMusic.haveToJoinVoiceChannel')
			return
		}

		if (this.resume && parseResult.args.length === 0) {
			if (this.playlist.isEmpty) {
				await this.#gc.send(msg, 'playMusic.playlistIsEmpty')
				return
			}

			this.guildInstance.playOn(member.voice.channel)
			return
		}

		this.playlist.clear()

		const addedMusics = await this.#addInternal(msg, parseResult)
		if (addedMusics.length === 0) {
			return
		}

		this.guildInstance.playOn(member.voice.channel)
		return
	}
}
