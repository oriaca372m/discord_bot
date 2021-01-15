import * as discordjs from 'discord.js'
import ytdl from 'ytdl-core'
import { ListItem, Selectable } from 'Src/features/play-music/interactor/listview'

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

export interface Music extends ListItem {
	getTitle(): string
	// 戻り値の関数は再生終了後の後処理用
	createDispatcher(
		connection: discordjs.VoiceConnection
	): [discordjs.StreamDispatcher, (() => void) | undefined]
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

	createDispatcher(
		connection: discordjs.VoiceConnection
	): [discordjs.StreamDispatcher, (() => void) | undefined] {
		return [connection.play(this.path), undefined]
	}
}

export type MusicObject = Fields<MusicFile> & { readonly metadata: MusicMetadataObject }

export class Artist implements Selectable {
	constructor(private readonly _name: string, private readonly musics: Music[]) {}

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
	constructor(private readonly _name: string, private readonly musics: Music[]) {}

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

export class YouTubeMusic implements Music {
	private _title!: string
	private _videoId!: string

	constructor(private _url: string) {}

	async init(): Promise<void> {
		this._videoId = ytdl.getVideoID(this._url)
		const info = await ytdl.getBasicInfo(this._videoId)
		this._title = info.player_response.videoDetails.title
	}

	getTitle(): string {
		return this._title
	}

	get videoId(): string {
		return this._videoId
	}

	toListString(): string {
		return `(youtube ${this.videoId}) ${this.getTitle()}`
	}

	select(): Music[] | undefined {
		return
	}

	createDispatcher(
		connection: discordjs.VoiceConnection
	): [discordjs.StreamDispatcher, (() => void) | undefined] {
		// とりあえず動く
		const stream = ytdl(this._videoId, { quality: 'highestaudio' })
		return [
			connection.play(stream),
			(): void => {
				stream.destroy()
			},
		]
	}
}
