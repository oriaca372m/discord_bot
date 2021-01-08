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
	readonly actions = [] as const

	constructor(readonly interactor: AddInteractor, private readonly _musics: Music[]) {
		this.gc = interactor.gc
	}

	readonly gc: FeatureGlobalConfig

	getItems(): readonly Music[] {
		return this._musics
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
