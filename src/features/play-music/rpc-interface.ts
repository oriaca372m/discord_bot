import { z } from 'zod'
import { f, iface } from 'Src/rpc/core'

export const SerializedMusic = z
	.object({
		kind: z.string(),
	})
	.passthrough()

export const SerializedIdGenerator = z.object({ next: z.number() })

export const PlaylistItemId = z.number()

export const SerializedPlaylistItem = z.object({ id: PlaylistItemId, music: SerializedMusic })
export const SerializedPlaylist = z.object({
	items: z.array(SerializedPlaylistItem),
	currentItemId: z.number().optional(),
	idGenerator: SerializedIdGenerator,
})

export const WebApiMusic = z.object({
	serialized: SerializedMusic,
	title: z.string(),
	album: z.string().optional(),
	artist: z.string().optional(),
})

export const playlistIface = iface(
	'playlist',
	[
		f('get', z.object({}), z.object({ playlist: SerializedPlaylist })),
		f(
			'add',
			z.object({ musics: z.array(SerializedMusic), destBefore: PlaylistItemId.optional() }),
			z.object({})
		),
		f(
			'move',
			z.object({ src: PlaylistItemId, destBefore: PlaylistItemId.optional() }),
			z.object({})
		),
		f('delete', z.object({ id: PlaylistItemId }), z.object({})),
		f('clear', z.object({}), z.object({})),
	],
	[]
)

export const playMusicIface = iface(
	'playMusic',
	[
		f('getAllMusics', z.object({}), z.object({ musics: z.array(WebApiMusic) })),
		f(
			'resolveUrl',
			z.object({ url: z.string() }),
			z.object({ musics: z.array(SerializedMusic) })
		),
		f('play', z.object({ id: PlaylistItemId }), z.object({})),
	],
	[playlistIface]
)
