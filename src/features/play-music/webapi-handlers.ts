import * as discordjs from 'discord.js'

import { WebApiHandler, AccessTokenInfo, HandlerError } from 'Src/features/webapi'

import { FeaturePlayMusic } from 'Src/features/play-music'
import { SerializedMusic } from 'Src/features/play-music/music'
import { deserializeMusic } from 'Src/features/play-music/music-deserialize'
import { resolveUrl } from 'Src/features/play-music/music-adder'

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

	handle(args: AddToPlaylistReq, tokenInfo: AccessTokenInfo): Promise<AddToPlaylistRes> {
		const guildInstance = this._feature.getGuildInstance(tokenInfo.guild)

		try {
			const music = deserializeMusic(this._feature, args.music)
			guildInstance.playlist.addMusic(music)
		} catch (e) {
			return Promise.resolve({ error: 'Could not add the music.' })
		}

		return Promise.resolve({})
	}
}

interface AddUrlToPlaylistReq {
	url: string
}

interface AddUrlToPlaylistRes {
	added: SerializedMusic[]
}

export class AddUrlToPlaylist implements WebApiHandler {
	readonly methodName = 'play-music/add-url-to-playlist'

	constructor(private readonly _feature: FeaturePlayMusic) {}

	async handle(
		args: AddUrlToPlaylistReq,
		tokenInfo: AccessTokenInfo
	): Promise<AddUrlToPlaylistRes> {
		const guildInstance = this._feature.getGuildInstance(tokenInfo.guild)
		let url: URL | undefined
		try {
			url = new URL(args.url)
		} catch {
			// pass
		}

		if (url === undefined) {
			throw new HandlerError('url is not an url.')
		}

		const musics = await resolveUrl(this._feature, url)
		for (const music of musics) {
			guildInstance.playlist.addMusic(music)
		}
		return { added: musics.map((x) => x.serialize()) }
	}
}

interface GetPlaylistRes {
	musics: SerializedMusic[]
}

export class GetPlaylist implements WebApiHandler {
	readonly methodName = 'play-music/get-playlist'

	constructor(private readonly _feature: FeaturePlayMusic) {}

	handle(_args: unknown, tokenInfo: AccessTokenInfo): Promise<GetPlaylistRes> {
		const guildInstance = this._feature.getGuildInstance(tokenInfo.guild)
		return Promise.resolve({
			musics: guildInstance.playlist.musics.map((x) => x.serialize()),
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

	handle(args: SetPlaylistReq, tokenInfo: AccessTokenInfo): Promise<SetPlaylistRes> {
		const guildInstance = this._feature.getGuildInstance(tokenInfo.guild)
		guildInstance.playlist.clear()
		for (const serializedMusic of args.musics) {
			try {
				const music = deserializeMusic(this._feature, serializedMusic)
				guildInstance.playlist.addMusic(music)
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
		const guildInstance = this._feature.getGuildInstance(tokenInfo.guild)

		let foundVoiceChannel: discordjs.VoiceChannel | undefined
		for (const [, channel] of tokenInfo.guild.channels.cache) {
			if (channel.type !== discordjs.ChannelType.GuildVoice) {
				continue
			}

			const vc = channel
			const size = vc.members.size
			if (0 < size) {
				if (foundVoiceChannel !== undefined && size <= foundVoiceChannel.members.size) {
					continue
				}

				foundVoiceChannel = vc
			}
		}

		if (foundVoiceChannel === undefined) {
			throw new HandlerError('Could not find a suitable voice channel to play musics.')
		}

		await guildInstance.makeConnection(foundVoiceChannel)
		guildInstance.playlist.switch(args.index)
		await guildInstance.play()
		return {}
	}
}
