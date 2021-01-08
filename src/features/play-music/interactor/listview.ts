import lodash from 'lodash'
import * as discordjs from 'discord.js'

import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'

import { Music } from 'Src/features/play-music/music'
import { AddInteractor } from 'Src/features/play-music/interactor/interactor'

export interface ListItem {
	toListString(): string
}

export interface ListAction {
	name: string
	do(args: string[], msg: discordjs.Message): Promise<void>
}

export interface ListView {
	getItems(): readonly ListItem[]
	actions: readonly ListAction[]
}

export interface Selectable extends ListItem {
	select(): Music[] | undefined
}

export class MusicListView implements ListView {
	readonly actions = [new AddAction(this), new PlayAction(this)] as const

	constructor(readonly interactor: AddInteractor, private readonly _musics: Music[]) {
		this.gc = interactor.gc
	}

	readonly gc: FeatureGlobalConfig

	getItems(): readonly ListItem[] {
		return this._musics
	}

	private addToPlaylistByIndex(indexes: string[]): Music[] | 'all' {
		if (indexes.length === 0) {
			for (const music of this._musics) {
				this.interactor.playlist.addMusic(music)
			}

			return 'all'
		}

		const addedMusics: Music[] = []
		for (const i of utils.parseIndexes(indexes, 0, this._musics.length)) {
			const music = this._musics[i]
			addedMusics.push(music)
			this.interactor.playlist.addMusic(music)
		}

		return addedMusics
	}

	async add(indexes: string[]): Promise<void> {
		const res = this.addToPlaylistByIndex(indexes)
		if (res === 'all') {
			await this.gc.sendToChannel(
				this.interactor.channel,
				'playMusic.interactor.addedMusic',
				{
					all: true,
					musics: [],
				}
			)
		} else {
			await this.gc.sendToChannel(
				this.interactor.channel,
				'playMusic.interactor.addedMusic',
				{
					all: false,
					musics: res,
				}
			)
		}
	}
}

class AddAction implements ListAction {
	readonly name = 'add'

	constructor(private readonly lv: MusicListView) {}

	async do(args: string[]): Promise<void> {
		await this.lv.add(args)
	}
}

class PlayAction implements ListAction {
	readonly name = 'play'

	constructor(private readonly lv: MusicListView) {}

	async do(args: string[], msg: discordjs.Message): Promise<void> {
		await this.lv.interactor.feature.playMusicEditingPlaylist(msg, async (playlist) => {
			playlist.clear()
			await this.lv.add(args)
		})
	}
}

export class SelectableListView implements ListView {
	readonly actions = [new SelectAction(this)] as const

	constructor(readonly interactor: AddInteractor, public readonly selectable: Selectable[]) {
		this.gc = interactor.gc
	}

	readonly gc: FeatureGlobalConfig

	getItems(): readonly ListItem[] {
		return this.selectable
	}
}

class SelectAction implements ListAction {
	readonly name = 'select'

	constructor(private readonly lv: SelectableListView) {}

	async do(indexes: string[]): Promise<void> {
		const res = lodash.flatten(
			utils
				.parseIndexes(indexes, 0, this.lv.selectable.length)
				.map((i) => this.lv.selectable[i].select())
		)

		if (res.every((x) => x !== undefined)) {
			await this.lv.interactor.setListView(
				new MusicListView(this.lv.interactor, res as Music[])
			)
		}
	}
}
