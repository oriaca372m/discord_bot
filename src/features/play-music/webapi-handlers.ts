import { WebApiHandler } from 'Src/features/webapi'

import { FeaturePlayMusic } from 'Src/features/play-music'
import { SerializedMusic, deserializeMusic } from 'Src/features/play-music/music'

interface WebApiMusic {
	readonly serialized: SerializedMusic
	readonly title: string
	readonly album?: string
	readonly artist?: string
}

// interface GetAllMusicsReq {}
interface GetAllMusicsRes {
	musics: WebApiMusic[]
}

export class GetAllMusics implements WebApiHandler {
	readonly methodName = 'play-music/get-all-musics'

	constructor(private readonly _feature: FeaturePlayMusic) {}

	handle(): Promise<GetAllMusicsRes> {
		return Promise.resolve({
			musics: this._feature.database.allMusics.map((x) => ({
				serialized: x.serialize(),
				title: x.metadata.title,
				album: x.metadata.album,
				artist: x.metadata.artist,
			})),
		})
	}
}

interface AddToPlaylistReq {
	music: SerializedMusic
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AddToPlaylistRes {}

export class AddToPlaylist implements WebApiHandler {
	readonly methodName = 'play-music/add-to-playlist'

	constructor(private readonly _feature: FeaturePlayMusic) {}

	handle(args: AddToPlaylistReq): Promise<AddToPlaylistRes> {
		try {
			const music = deserializeMusic(args.music, this._feature.database)
			this._feature.playlist.addMusic(music)
		} catch (e) {
			return Promise.resolve({ error: 'Could not add the music.' })
		}

		return Promise.resolve({})
	}
}
