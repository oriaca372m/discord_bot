import * as discordjs from 'discord.js'
import { Music, YouTubeMusic } from 'Src/features/play-music/music'
import { FeaturePlayMusic } from 'Src/features/play-music'
import * as utils from 'Src/utils'

interface ParseArgsResult {
	args: string[]
	isYouTube: boolean
	isAddToFirst: boolean
	isAddToNext: boolean
}

export class MusicAdder {
	constructor(
		private readonly feature: FeaturePlayMusic,
		private readonly _listMusics?: readonly Music[],
		private readonly _resume: boolean = false
	) {}

	private async parseArgs(
		msg: discordjs.Message,
		rawArgs: string[]
	): Promise<ParseArgsResult | undefined> {
		let args: string[], options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, []))
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			await this.feature.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		const isYouTube = utils.getOption(options, ['y', 'youtube']) as boolean
		const isAddToFirst = utils.getOption(options, ['f', 'first']) as boolean
		const isAddToNext = utils.getOption(options, ['n', 'next']) as boolean

		if (isAddToFirst && isAddToNext) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			await this.feature.gc.send(msg, 'playMusic.invalidCommand', {
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

	private getMusics(keywords: string[], isYouTube: boolean): Music[] {
		const musics = []

		const listMusics = this._listMusics
		if (listMusics !== undefined) {
			let indexes: number[] | undefined = undefined
			try {
				indexes = utils.parseIndexes(keywords, 0, listMusics.length)
			} catch (_) {
				// pass
			}

			if (indexes !== undefined) {
				return indexes.map((x) => listMusics[x])
			}
		}

		for (const keyword of keywords) {
			if (isYouTube) {
				musics.push(new YouTubeMusic(keyword))
			} else {
				const music = this.feature.database.search(keyword)[0]
				if (music !== undefined) {
					musics.push(music)
				}
			}
		}

		return musics
	}

	private addMusicsToPlaylist(musics: readonly Music[], parseResult: ParseArgsResult): void {
		let counter = 0
		if (parseResult.isAddToNext) {
			const c = this.feature.playlist.currentTrack
			if (c !== undefined) {
				counter = c + 1
			}
		}
		for (const music of musics) {
			if (parseResult.isAddToFirst || parseResult.isAddToNext) {
				this.feature.playlist.addMusic(music, counter)
				counter++
			} else {
				this.feature.playlist.addMusic(music)
			}
		}
	}

	private async addInternal(
		msg: discordjs.Message,
		parseResult: ParseArgsResult
	): Promise<readonly Music[]> {
		if (this._listMusics !== undefined && parseResult.args.length === 0) {
			this.addMusicsToPlaylist(this._listMusics, parseResult)
			await this.feature.gc.send(msg, 'playMusic.interactor.addedMusic', {
				all: true,
				musics: [],
			})

			return this._listMusics
		}

		const toAddMusics = this.getMusics(parseResult.args, parseResult.isYouTube)
		this.addMusicsToPlaylist(toAddMusics, parseResult)

		if (toAddMusics.length === 0) {
			await msg.reply('そんな曲は無いロボ…')
		} else {
			await msg.reply(
				`プレイリストに追加したロボ!:\n${toAddMusics.map((x) => x.getTitle()).join('\n')}`
			)
		}

		return toAddMusics
	}

	async add(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		const parseResult = await this.parseArgs(msg, rawArgs)
		if (parseResult === undefined) {
			return
		}

		await this.addInternal(msg, parseResult)
	}

	async play(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		const parseResult = await this.parseArgs(msg, rawArgs)
		if (parseResult === undefined) {
			return
		}

		const member = msg.member
		if (!member) {
			return
		}

		if (!member.voice.channel) {
			await this.feature.gc.send(msg, 'playMusic.haveToJoinVoiceChannel')
			return
		}

		if (this._resume && parseResult.args.length === 0) {
			if (this.feature.playlist.isEmpty) {
				await msg.reply('今はプレイリストが空ロボ')
				return
			}

			await this.feature.makeConnection(member.voice.channel)
			await this.feature.play()
			return
		}

		this.feature.playlist.clear()

		const addedMusics = await this.addInternal(msg, parseResult)
		if (addedMusics.length === 0) {
			return
		}

		await this.feature.makeConnection(member.voice.channel)
		await this.feature.play()
		return
	}
}
