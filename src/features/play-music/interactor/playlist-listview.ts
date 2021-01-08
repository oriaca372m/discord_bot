import { FeatureGlobalConfig } from 'Src/features/global-config'

import { Playlist } from 'Src/features/play-music/playlist'
import { AddInteractor } from 'Src/features/play-music/interactor/interactor'
import { ListView, ListAction, ListItem } from 'Src/features/play-music/interactor/listview'

export class PlaylistListView implements ListView {
	private readonly _actions: readonly ListAction[]

	constructor(readonly interactor: AddInteractor, public readonly playlist: Playlist) {
		this.gc = interactor.gc
		this._actions = []
	}

	readonly gc: FeatureGlobalConfig

	getItems(): readonly ListItem[] {
		return this.playlist.musics
	}

	getActions(): readonly ListAction[] {
		return this._actions
	}
}
