import * as discordjs from 'discord.js'

import type { FeaturePlayMusic } from './'
import type { GuildInstance } from './guild-instance'
import { playMusicIface } from './rpc-interface'
import { deserializeMusic } from './music-deserialize'
import { resolveUrl } from './music-adder'

import { bindContext } from 'Src/rpc/server'
import { type WebApi2Context, HandlerError } from 'Src/features/webapi-server2/context'
import * as u from 'Src/utils'

export interface PlayMusicContext extends WebApi2Context {
	feature: FeaturePlayMusic
	guildInstance: GuildInstance
}

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
		f('addUrlToPlaylist', async (ctx, req) => {
			const url = u
				.tryEither(() => new URL(req.url))
				.okOrThrow(new HandlerError('url is not an url.'))

			const musics = await resolveUrl(ctx.feature, url)
			for (const music of musics) {
				ctx.guildInstance.playlist.addMusic(music)
			}
			return { added: musics.map((x) => x.serialize()) }
		}),
		f('addToPlaylist', (ctx, req) => {
			const music = u
				.tryEither(() => deserializeMusic(ctx.feature.database, req.music))
				.okOrThrow((e) => new HandlerError(`Could not deserialize the music: ${String(e)}`))
			ctx.guildInstance.playlist.addMusic(music)
			return Promise.resolve({})
		}),
		f('getPlaylist', (ctx, _req) => {
			return Promise.resolve({
				musics: ctx.guildInstance.playlist.musics.map((x) => x.serialize()),
			})
		}),
		f('setPlaylist', (ctx, req) => {
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

			ctx.guildInstance.playlist.switch(req.index)
			ctx.guildInstance.playOn(foundVoiceChannel)
			return Promise.resolve({})
		}),
	],
	[]
)
