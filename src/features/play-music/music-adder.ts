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
		private readonly _listMusics?: readonly Music[],
		private readonly _resume: boolean = false
	) {
		this.#gc = guildInstance.feature.gc
		this.#database = guildInstance.feature.database
	}

	private async parseOptions(
		msg: discordjs.Message,
		rawArgs: string[]
	): Promise<CommandOptions | undefined> {
		let args: string[], options
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
		let url: URL | undefined
		try {
			url = new URL(keyword)
		} catch {
			// pass
		}

		if (url !== undefined) {
			return resolveUrl(this.guildInstance.feature, url)
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

	private async getMusics(keywords: string[], isYouTube: boolean): Promise<Music[]> {
		const musics: Music[] = []

		const listMusics = this._listMusics
		if (listMusics !== undefined) {
			let indexes: number[] | undefined
			try {
				indexes = utils.parseIndexes(keywords, 0, listMusics.length)
			} catch {
				// pass
			}

			if (indexes !== undefined) {
				return indexes.map((x) => listMusics[x])
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

	private addMusicsToPlaylist(musics: readonly Music[], parseResult: CommandOptions): void {
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

	private async addInternal(
		msg: discordjs.Message,
		parseResult: CommandOptions
	): Promise<readonly Music[]> {
		if (this._listMusics !== undefined && parseResult.args.length === 0) {
			this.addMusicsToPlaylist(this._listMusics, parseResult)
			await this.#gc.send(msg, 'playMusic.interactor.addedMusic', {
				all: true,
				musics: [],
			})

			return this._listMusics
		}

		const toAddMusics = await this.getMusics(parseResult.args, parseResult.isYouTube)
		this.addMusicsToPlaylist(toAddMusics, parseResult)

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
		const parseResult = await this.parseOptions(msg, rawArgs)
		if (parseResult === undefined) {
			return
		}

		await this.addInternal(msg, parseResult)
	}

	async play(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		const parseResult = await this.parseOptions(msg, rawArgs)
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

		if (this._resume && parseResult.args.length === 0) {
			if (this.playlist.isEmpty) {
				await msg.reply('今はプレイリストが空ロボ')
				return
			}

			this.guildInstance.playOn(member.voice.channel)
			return
		}

		this.playlist.clear()

		const addedMusics = await this.addInternal(msg, parseResult)
		if (addedMusics.length === 0) {
			return
		}

		this.guildInstance.playOn(member.voice.channel)
		return
	}
}
