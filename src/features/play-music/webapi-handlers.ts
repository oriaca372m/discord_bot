import { z } from 'zod'
import * as discordjs from 'discord.js'

import { WebApiHandler, AccessTokenInfo, HandlerError } from 'Src/features/webapi'

import { FeaturePlayMusic } from 'Src/features/play-music'
import { GuildInstance } from 'Src/features/play-music/guild-instance'
import { SerializedMusic } from 'Src/features/play-music/music'
import { deserializeMusic } from 'Src/features/play-music/music-deserialize'
import { resolveUrl } from 'Src/features/play-music/music-adder'

interface Context {
	feature: FeaturePlayMusic
	guildInstance: GuildInstance
	tokenInfo: AccessTokenInfo
}

type HandlerConstructor = new (feature: FeaturePlayMusic) => WebApiHandler

function createHandlerConstructor<Req, Res>(
	methodName: string,
	ReqZodType: z.ZodType<Req>,
	ResZodType: z.ZodType<Res>,
	func: (req: Req, ctx: Context) => Promise<Res>
): HandlerConstructor {
	return class implements WebApiHandler {
		readonly methodName = `play-music/${methodName}`

		constructor(private readonly _feature: FeaturePlayMusic) {}

		async handle(args: unknown, tokenInfo: AccessTokenInfo): Promise<unknown> {
			const req = ReqZodType.parse(args)

			const ctx: Context = {
				feature: this._feature,
				guildInstance: this._feature.getGuildInstance(tokenInfo.guild),
				tokenInfo,
			}

			const ret = await func(req, ctx)
			const res = ResZodType.parse(ret)
			return res
		}
	}
}

const WebApiMusic = z.object({
	serialized: SerializedMusic,
	title: z.string(),
	album: z.string().optional(),
	artist: z.string().optional(),
})

export const GetAllMusics = createHandlerConstructor(
	'get-all-musics',
	z.object({}),
	z.object({
		musics: z.array(WebApiMusic),
	}),
	(_req, ctx) => {
		const musics = ctx.feature.database.allMusics.map((x) => ({
			serialized: x.serialize(),
			title: x.metadata.title,
			album: x.metadata.album,
			artist: x.metadata.artist,
		}))
		return Promise.resolve({ musics })
	}
)

export const AddToPlaylist = createHandlerConstructor(
	'add-to-playlist',
	z.object({ music: SerializedMusic }),
	z.object({}),
	(req, ctx) => {
		try {
			const music = deserializeMusic(ctx.feature.database, req.music)
			ctx.guildInstance.playlist.addMusic(music)
		} catch (e) {
			return Promise.resolve({ error: 'Could not add the music.' })
		}

		return Promise.resolve({})
	}
)

export const AddUrlToPlaylist = createHandlerConstructor(
	'add-url-to-playlist',
	z.object({ url: z.string() }),
	z.object({ added: z.array(SerializedMusic) }),
	async (req, ctx) => {
		let url: URL | undefined
		try {
			url = new URL(req.url)
		} catch {
			// pass
		}

		if (url === undefined) {
			throw new HandlerError('url is not an url.')
		}

		const musics = await resolveUrl(ctx.feature, url)
		for (const music of musics) {
			ctx.guildInstance.playlist.addMusic(music)
		}
		return { added: musics.map((x) => x.serialize()) }
	}
)

export const GetPlaylist = createHandlerConstructor(
	'get-playlist',
	z.object({}),
	z.object({
		musics: z.array(SerializedMusic),
	}),
	(_req, ctx) => {
		return Promise.resolve({
			musics: ctx.guildInstance.playlist.musics.map((x) => x.serialize()),
		})
	}
)

export const SetPlaylist = createHandlerConstructor(
	'set-playlist',
	z.object({ musics: z.array(SerializedMusic) }),
	z.object({}),
	(req, ctx) => {
		ctx.guildInstance.playlist.clear()
		for (const serializedMusic of req.musics) {
			try {
				const music = deserializeMusic(ctx.feature.database, serializedMusic)
				ctx.guildInstance.playlist.addMusic(music)
			} catch (_) {
				// pass
			}
		}

		return Promise.resolve({})
	}
)

export const Play = createHandlerConstructor(
	'play',
	z.object({ index: z.number() }),
	z.object({}),
	(req, ctx) => {
		let foundVoiceChannel: discordjs.VoiceChannel | undefined
		for (const [, channel] of ctx.tokenInfo.guild.channels.cache) {
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

		ctx.guildInstance.playlist.switch(req.index)
		ctx.guildInstance.playOn(foundVoiceChannel)
		return Promise.resolve({})
	}
)

export const allHandlers: HandlerConstructor[] = [
	GetAllMusics,
	AddToPlaylist,
	AddUrlToPlaylist,
	GetPlaylist,
	SetPlaylist,
	Play,
]
