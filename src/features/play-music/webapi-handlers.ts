import * as discordjs from 'discord.js'

import { WebApiHandler, AccessTokenInfo } from 'Src/features/webapi'

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

interface GetPlaylistRes {
	musics: SerializedMusic[]
}

export class GetPlaylist implements WebApiHandler {
	readonly methodName = 'play-music/get-playlist'

	constructor(private readonly _feature: FeaturePlayMusic) {}

	handle(): Promise<GetPlaylistRes> {
		return Promise.resolve({
			musics: this._feature.playlist.musics.map((x) => x.serialize()),
		})
	}
}

interface SetPlaylistReq {
	musics: SerializedMusic[]
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface SetPlaylistRes {}

export class SetPlaylist implements WebApiHandler {
	readonly methodName = 'play-music/set-playlist'

	constructor(private readonly _feature: FeaturePlayMusic) {}

	handle(args: SetPlaylistReq): Promise<SetPlaylistRes> {
		this._feature.playlist.clear()
		for (const serializedMusic of args.musics) {
			try {
				const music = deserializeMusic(serializedMusic, this._feature.database)
				this._feature.playlist.addMusic(music)
			} catch (_) {
				// pass
			}
		}

		return Promise.resolve({})
	}
}

interface PlayReq {
	index: number
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface PlayRes {}

export class Play implements WebApiHandler {
	readonly methodName = 'play-music/play'

	constructor(private readonly _feature: FeaturePlayMusic) {}

	async handle(args: PlayReq, tokenInfo: AccessTokenInfo): Promise<PlayRes> {
		let foundVoiceChannel: discordjs.VoiceChannel | undefined
		for (const [, channel] of tokenInfo.guild.channels.cache) {
			if (channel.type !== 'voice') {
				continue
			}

			const vc = channel as discordjs.VoiceChannel
			const size = vc.members.size
			if (0 < size) {
				if (foundVoiceChannel !== undefined && size <= foundVoiceChannel.members.size) {
					continue
				}

				foundVoiceChannel = vc
			}
		}

		if (foundVoiceChannel === undefined) {
			return { error: 'Could not find a suitable voice channel to play musics.' }
		}

		await this._feature.makeConnection(foundVoiceChannel)
		this._feature.playlist.switch(args.index)
		await this._feature.play()
		return {}
	}
}
