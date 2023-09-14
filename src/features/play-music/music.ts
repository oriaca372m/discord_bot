import { createReadStream } from 'node:fs'
import { z } from 'zod'
import * as voice from '@discordjs/voice'

import { ListItem, Selectable } from 'Src/features/play-music/interactor/listview'
import { MusicDatabase } from 'Src/features/play-music/music-database'

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

export const SerializedMusic = z
	.object({
		kind: z.string(),
	})
	.passthrough()

export interface MusicPlayResource {
	audioResource: voice.AudioResource
	finalizer?(): void
}

export interface Music extends ListItem {
	getTitle(): string
	serialize(): z.infer<typeof SerializedMusic>

	createResource(): MusicPlayResource
}

const SerializedMusicFile = z.object({
	kind: z.literal('file'),
	uuid: z.string(),
})

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

	serialize(): z.infer<typeof SerializedMusicFile> {
		return { kind: 'file', uuid: this.uuid } satisfies z.infer<typeof SerializedMusicFile>
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
		// HACK: パスを直接渡すと、以前にストリームを渡していた場合、再生できなくなる
		return { audioResource: voice.createAudioResource(createReadStream(this.path)) }
	}

	static deserialize(data: unknown, database: MusicDatabase): Music {
		const { uuid } = SerializedMusicFile.parse(data)
		const music = database.getByUuid(uuid)
		if (music === undefined) {
			throw new Error(`UUIDが存在しない曲を読み込もうとしました: ${uuid}`)
		}

		return music
	}
}

export type MusicObject = Fields<MusicFile> & { readonly metadata: MusicMetadataObject }

export class Artist implements Selectable {
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

export class Album implements Selectable {
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
