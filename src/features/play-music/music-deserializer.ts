import type { z } from 'zod'

import type { Music } from './music'
import { MusicFile } from './music-file'
import type { MusicDatabase } from './music-database'
import { YouTubeMusic } from './youtube'
import { SerializedMusic } from './rpc-interface'

export class MusicDeserializer {
	constructor(private readonly database: MusicDatabase) {}

	deserialize(data: z.infer<typeof SerializedMusic>): Music {
		if (data.kind === 'file') {
			return MusicFile.deserialize(data, this.database)
		}
		if (data.kind === 'youtube') {
			return YouTubeMusic.deserialize(data)
		}
		throw new Error(`不明なkindの曲を読み込もうとしました: ${data.kind}`)
	}

	deserializeUnknown(data: unknown): Music {
		return this.deserialize(SerializedMusic.parse(data))
	}
}
