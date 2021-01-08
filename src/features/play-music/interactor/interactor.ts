import * as discordjs from 'discord.js'

import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'

import { FeaturePlayMusic } from 'Src/features/play-music'
import { Music } from 'Src/features/play-music/music'
import { Playlist } from 'Src/features/play-music/playlist'
import {
	ListView,
	MusicListView,
	SelectableListView,
} from 'Src/features/play-music/interactor/listview'

import { PlaylistListView } from 'Src/features/play-music/interactor/playlist-listview'

export class AddInteractor {
	readonly gc: FeatureGlobalConfig
	private _listView: ListView | undefined

	constructor(
		public readonly channel: utils.LikeTextChannel,
		public readonly feature: FeaturePlayMusic,
		public readonly playlist: Playlist,
		private readonly done: () => void
	) {
		this.gc = this.feature.gc
	}

	async welcome(): Promise<void> {
		await this.gc.sendToChannel(this.channel, 'playMusic.interactor.welcome')
	}

	async setListView(lv: ListView): Promise<void> {
		this._listView = lv
		await this.show(1)
	}

	async search(keyword: string): Promise<void> {
		await this.setListView(new MusicListView(this, this.feature.database.search(keyword)))
	}

	async searchArtist(keyword: string): Promise<void> {
		await this.setListView(
			new SelectableListView(this, this.feature.database.searchArtistName(keyword))
		)
	}

	async searchAlbum(keyword: string): Promise<void> {
		await this.setListView(
			new SelectableListView(this, this.feature.database.searchAlbumName(keyword))
		)
	}

	async show(pageNumber: number): Promise<void> {
		if (this._listView === undefined) {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.resultNotFound')
			return
		}

		const val = this._listView.getItems()
		const res = utils.pagination(val, pageNumber)

		if (res.kind === 'empty') {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.resultNotFound')
		} else if (res.kind === 'invalidPageId') {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.invalidPageId', {
				maxPage: res.maxPage,
			})
		} else if (res.kind === 'ok') {
			const text = (res.value as Music[])
				.map((v, i) => `${res.firstIndex + i}: ${v.toListString()}`)
				.join('\n')

			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.list', {
				currentPage: pageNumber,
				maxPage: res.maxPage,
				results: text,
			})
		} else {
			utils.unreachable(res)
		}
	}

	private async handlePlayAndAdd(
		msg: discordjs.Message,
		cmdname: string,
		rawArgs: string[]
	): Promise<boolean> {
		let args: string[], options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, [], 1))
		} catch (_) {
			return false
		}

		const isYouTube = utils.getOption(options, ['y', 'youtube']) as boolean

		if (args.every((x) => isNaN(parseInt(x, 10)))) {
			if (cmdname === 'play') {
				await this.feature.playMusicEditingPlaylist(msg, async (playlist) => {
					playlist.clear()
					await this.feature.addToPlaylist(msg, args, isYouTube)
				})
				return true
			}

			if (cmdname === 'add') {
				await this.feature.addToPlaylist(msg, args, isYouTube)
				return true
			}
		}

		utils.unreachable()
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		if (msg.channel.id !== this.channel.id) {
			return
		}

		const res = utils.parseShellLikeCommand(msg.content)
		if (res === undefined || res.length < 1) {
			await this.gc.send(msg, 'playMusic.interactor.invalidCommand')
			return
		}

		const [cmdname, ...rawArgs] = res

		if (['play', 'add'].includes(cmdname)) {
			if (await this.handlePlayAndAdd(msg, cmdname, rawArgs)) {
				return
			}
		}

		if (this._listView !== undefined) {
			const action = this._listView.actions.find((x) => x.name === cmdname)
			if (action !== undefined) {
				await action.do(rawArgs, msg)
				return
			}
		}

		await utils.subCommandProxy(
			{
				help: async () => {
					await this.gc.send(msg, 'playMusic.interactor.help')
				},
				search: async (args) => {
					if (args.length < 1) {
						await this.gc.send(msg, 'playMusic.interactor.haveToSpecifyKeyword')
						return
					}

					await this.search(args[0])
				},
				searchArtist: async (args) => {
					if (args.length < 1) {
						await this.gc.send(msg, 'playMusic.interactor.haveToSpecifyKeyword')
						return
					}

					await this.searchArtist(args[0])
				},
				searchAlbum: async (args) => {
					if (args.length < 1) {
						await this.gc.send(msg, 'playMusic.interactor.haveToSpecifyKeyword')
						return
					}

					await this.searchAlbum(args[0])
				},
				show: async (args) => {
					await this.show(parseInt(args[0], 10) || 1)
				},
				quit: async () => {
					this.done()
					await this.gc.send(msg, 'playMusic.interactor.quit')
				},
				playlist: async () => {
					await this.setListView(new PlaylistListView(this, this.playlist))
				},
			},
			res,
			msg
		)
	}
}
