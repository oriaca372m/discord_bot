import { z } from 'zod'
import * as voice from '@discordjs/voice'

import { ListItem, Selectable } from 'Src/features/play-music/interactor/listview'
import { SerializedMusic } from './rpc-interface'

export interface MusicPlayResource {
	audioResource: voice.AudioResource
	finalizer?(): void
}

export interface Music extends ListItem {
	getTitle(): string
	serialize(): z.infer<typeof SerializedMusic>

	createResource(): MusicPlayResource
}

export class MusicCollection implements Selectable {
	constructor(
		readonly name: string,
		private readonly musics: Music[]
	) {}

	toListString(): string {
		return this.name
	}

	select(): Music[] | undefined {
		return this.musics
	}
}
