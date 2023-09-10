import * as voice from '@discordjs/voice'
import { ListItem, Selectable } from 'Src/features/play-music/interactor/listview'
import { SerializedYouTubeMusic } from './youtube'

type FieldNames<T> = {
	// eslint-disable-next-line @typescript-eslint/ban-types
	[P in keyof T]: T[P] extends Function ? never : P
}[keyof T]
type Fields<T> = { [P in FieldNames<T>]: T[P] }

export class MusicMetadata {
	readonly title: string
	readonly album?: string
	readonly artist?: string
	readonly track: { no: number | null; of: number | null }
	readonly disk: { no: number | null; of: number | null }

	constructor(obj: MusicMetadataObject) {
		this.title = obj.title
		this.album = obj.album
		this.artist = obj.artist
		this.track = obj.track
		this.disk = obj.disk
	}
}

export type MusicMetadataObject = Fields<MusicMetadata>

export type SerializedMusic = SerializedMusicFile | SerializedYouTubeMusic

export interface SerializedMusicFile {
	kind: 'file'
	uuid: string
}

export interface MusicPlayResource {
	audioResource: voice.AudioResource
	finalizer?: () => void
}

export interface Music extends ListItem {
	getTitle(): string
	serialize(): SerializedMusic

	createResource(): MusicPlayResource
}

export class MusicFile implements Music {
	readonly uuid: string
	readonly path: string
	readonly metadata: MusicMetadata
	readonly memberMusicList?: string

	constructor(obj: MusicObject) {
		this.uuid = obj.uuid
		this.path = obj.path
		this.metadata = new MusicMetadata(obj.metadata)
		this.memberMusicList = obj.memberMusicList
	}

	getTitle(): string {
		return this.metadata.title
	}

	serialize(): SerializedMusicFile {
		return { kind: 'file', uuid: this.uuid }
	}

	toListString(): string {
		if (this.memberMusicList !== undefined) {
			return `${this.metadata.title} (from: ${this.memberMusicList})`
		} else {
			return this.metadata.title
		}
	}

	select(): Music[] | undefined {
		return
	}

	createResource(): MusicPlayResource {
		return { audioResource: voice.createAudioResource(this.path) }
	}
}

export type MusicObject = Fields<MusicFile> & { readonly metadata: MusicMetadataObject }

export class Artist implements Selectable {
	constructor(
		private readonly _name: string,
		private readonly musics: Music[]
	) {}

	get name(): string {
		return this._name
	}

	toListString(): string {
		return this.name
	}

	select(): Music[] | undefined {
		return this.musics
	}
}

export class Album implements Selectable {
	constructor(
		private readonly _name: string,
		private readonly musics: Music[]
	) {}

	get name(): string {
		return this._name
	}

	toListString(): string {
		return this.name
	}

	select(): Music[] | undefined {
		return this.musics
	}
}
