import * as discordjs from 'discord.js'

import type { FeaturePlayMusic } from './'
import type { GuildInstance } from './guild-instance'
import { playMusicIface, playlistIface } from './rpc-interface'
import { MusicDeserializer } from './music-deserializer'
import { resolveUrl } from './music-adder'

import { bindContext } from 'Src/rpc/server'
import { type WebApi2Context, HandlerError } from 'Src/features/webapi-server2/context'
import * as u from 'Src/utils'

export interface PlayMusicContext extends WebApi2Context {
	feature: FeaturePlayMusic
	guildInstance: GuildInstance
}

const { f: pF, createRpcServer: pCreateRpcServer } = bindContext<
	PlayMusicContext,
	typeof playlistIface
>(playlistIface)
const playlistServer = pCreateRpcServer(
	[
		pF('get', (ctx, _req) => {
			return Promise.resolve({ playlist: ctx.guildInstance.playlist.serialize() })
		}),

		pF('add', (ctx, req) => {
			const deserializer = new MusicDeserializer(ctx.feature.database)
			const musics = u
				.tryEither(() => req.musics.map((x) => deserializer.deserialize(x)))
				.okOrThrow((e) => new HandlerError(`Could not deserialize the music: ${String(e)}`))
			ctx.guildInstance.playlist.addMusics(musics, req.destBefore)
			return Promise.resolve({})
		}),

		pF('move', (ctx, req) => {
			ctx.guildInstance.playlist.moveItem(req.src, req.destBefore)
			return Promise.resolve({})
		}),

		pF('delete', (ctx, req) => {
			ctx.guildInstance.playlist.deleteItem(req.id)
			return Promise.resolve({})
		}),
	],
	[]
)

const { f, createRpcServer } = bindContext<PlayMusicContext, typeof playMusicIface>(playMusicIface)
export const playMusicServer = createRpcServer(
	[
		f('getAllMusics', (ctx, _req) => {
			const musics = ctx.feature.database.allMusics.map((x) => ({
				serialized: x.serialize(),
				title: x.metadata.title,
				album: x.metadata.album,
				artist: x.metadata.artist,
			}))
			return Promise.resolve({ musics })
		}),

		f('resolveUrl', async (ctx, req) => {
			const url = u
				.tryEither(() => new URL(req.url))
				.okOrThrow(new HandlerError('url is not an url.'))
			const musics = await resolveUrl(ctx.feature, url)
			return { musics: musics.map((x) => x.serialize()) }
		}),

		f('play', (ctx, req) => {
			let foundVoiceChannel: discordjs.VoiceChannel | undefined
			for (const [, channel] of ctx.guild.channels.cache) {
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

			ctx.guildInstance.playlist.switch(req.id)
			ctx.guildInstance.playOn(foundVoiceChannel)
			return Promise.resolve({})
		}),
	],
	[playlistServer]
)
