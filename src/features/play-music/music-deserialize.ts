import { Music, SerializedMusic } from 'Src/features/play-music/music'
import { MusicFile } from 'Src/features/play-music/music-file'
import { MusicDatabase } from 'Src/features/play-music/music-database'
import { YouTubeMusic } from 'Src/features/play-music/youtube'

export function deserializeMusic(database: MusicDatabase, data: unknown): Music {
	const { kind } = SerializedMusic.parse(data)
	if (kind === 'file') {
		return MusicFile.deserialize(data, database)
	} else if (kind === 'youtube') {
		return YouTubeMusic.deserialize(data)
	} else {
		throw new Error(`不明なkindの曲を読み込もうとしました: ${kind}`)
	}
}
