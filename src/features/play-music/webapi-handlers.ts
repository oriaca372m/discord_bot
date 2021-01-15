import { WebApiHandler } from 'Src/features/webapi'

import { FeaturePlayMusic } from 'Src/features/play-music'

interface WebApiMusic {
	readonly uuid: string
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
				uuid: x.uuid,
				title: x.metadata.title,
				album: x.metadata.album,
				artist: x.metadata.artist,
			})),
		})
	}
}

interface AddToPlaylistReq {
	uuid: string
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AddToPlaylistRes {}

export class AddToPlaylist implements WebApiHandler {
	readonly methodName = 'play-music/add-to-playlist'

	constructor(private readonly _feature: FeaturePlayMusic) {}

	handle(args: AddToPlaylistReq): Promise<AddToPlaylistRes> {
		const music = this._feature.database.getByUuid(args.uuid)
		if (music === undefined) {
			return Promise.resolve({ error: "couldn't find a music which have that uuid." })
		}
		this._feature.playlist.addMusic(music)
		return Promise.resolve({})
	}
}
