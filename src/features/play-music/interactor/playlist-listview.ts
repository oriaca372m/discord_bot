import { FeatureGlobalConfig } from 'Src/features/global-config'

import { Playlist } from 'Src/features/play-music/playlist'
import { AddInteractor } from 'Src/features/play-music/interactor/interactor'
import { ListView, ListAction, ListItem } from 'Src/features/play-music/interactor/listview'

export class PlaylistListView implements ListView {
	readonly actions = [new MoveAction(this), new ShuffleAction(this)] as const

	constructor(readonly interactor: AddInteractor, public readonly playlist: Playlist) {
		this.gc = interactor.gc
	}

	readonly gc: FeatureGlobalConfig

	getItems(): readonly ListItem[] {
		return this.playlist.musics
	}
}

class MoveAction implements ListAction {
	readonly name = 'sw'

	constructor(private readonly lv: PlaylistListView) {}

	async do(args: string[]): Promise<void> {
		this.lv.playlist.switch(parseInt(args[0], 10))
		await this.lv.interactor.feature.play()
	}
}

class ShuffleAction implements ListAction {
	readonly name = 'shuffle'

	constructor(private readonly lv: PlaylistListView) {}

	async do(): Promise<void> {
		this.lv.playlist.shuffle()
		await this.lv.interactor.feature.play()
	}
}
