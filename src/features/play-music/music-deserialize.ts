import { FeaturePlayMusic } from '.'
import { YouTubeMusic } from './youtube'
import { Music, SerializedMusic } from './music'
import * as u from 'Src/utils'

export function deserializeMusic(feature: FeaturePlayMusic, data: SerializedMusic): Music {
	const kind = data.kind
	if (kind === 'file') {
		const music = feature.database.getByUuid(data.uuid)
		if (music === undefined) {
			throw new Error('存在しないUUID')
		}

		return music
	} else if (kind === 'youtube') {
		return YouTubeMusic.deserialize(data)
	} else {
		u.unreachable(kind)
	}
}
