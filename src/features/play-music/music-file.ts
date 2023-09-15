import { createReadStream } from 'node:fs'
import { z } from 'zod'
import * as voice from '@discordjs/voice'

import { Music, MusicTag, MusicPlayResource } from 'Src/features/play-music/music'
import { MusicDatabase } from 'Src/features/play-music/music-database'

const SerializedMusicFile = z.object({
	kind: z.literal('file'),
	uuid: z.string(),
})

export class MusicFile implements Music {
	constructor(
		readonly uuid: string,
		readonly path: string,
		readonly tag: z.infer<typeof MusicTag>,
		readonly memberMusicList?: string
	) {}

	getTitle(): string {
		return this.tag.title
	}

	serialize(): z.infer<typeof SerializedMusicFile> {
		return { kind: 'file', uuid: this.uuid }
	}

	toListString(): string {
		if (this.memberMusicList !== undefined) {
			return `${this.tag.title} (from: ${this.memberMusicList})`
		} else {
			return this.tag.title
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
