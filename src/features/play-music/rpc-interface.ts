import { z } from 'zod'
import { f, iface } from 'Src/rpc/core'

export const SerializedMusic = z
	.object({
		kind: z.string(),
	})
	.passthrough()

export const WebApiMusic = z.object({
	serialized: SerializedMusic,
	title: z.string(),
	album: z.string().optional(),
	artist: z.string().optional(),
})

export const playMusicIface = iface(
	'playMusic',
	[
		f('getAllMusics', z.object({}), z.object({ musics: z.array(WebApiMusic) })),
		f('addToPlaylist', z.object({ musics: SerializedMusic }), z.undefined()),
		f(
			'addUrlToPlaylist',
			z.object({ url: z.string() }),
			z.object({ added: z.array(SerializedMusic) })
		),
		f('get-playlist', z.object({}), z.object({ musics: z.array(SerializedMusic) })),
		f('set-playlist', z.object({ musics: z.array(SerializedMusic) }), z.object({})),
		f('play', z.object({ index: z.number() }), z.object({})),
	],
	[]
)
