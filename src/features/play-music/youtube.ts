import { spawn, execFile } from 'child_process'
import { z } from 'zod'
import * as voice from '@discordjs/voice'

import * as utils from 'Src/utils'

import { Music, MusicPlayResource } from 'Src/features/play-music/music'

const ytdlPath = 'yt-dlp'

const SerializedYouTubeMusic = z.object({
	kind: z.literal('youtube'),
	url: z.string(),
	title: z.string(),
})

const YtdlJson = z.object({
	title: z.string(),
})

function getTitle(url: string): Promise<string | undefined> {
	return new Promise((resolve, reject) => {
		execFile(
			ytdlPath,
			['--no-playlist', '--dump-json', '--', url],
			{ maxBuffer: 1024 * 1024 * 10 },
			(error: Error | null, stdout: string | Buffer) => {
				if (error) {
					reject(error)
				}

				try {
					utils.mustString(stdout)
					resolve(YtdlJson.parse(JSON.parse(stdout)).title)
				} catch (e) {
					resolve(undefined)
				}
			}
		)
	})
}

function youTubeVideoIdToUrl(id: string): string {
	return `https://youtube.com/watch?v=${id}`
}

export class YouTubeMusic implements Music {
	#title: string | undefined

	constructor(
		private url: string,
		title?: string
	) {
		utils.mustValidUrl(url)
		this.#title = title
	}

	async init(youTubeApiKey: string | undefined): Promise<void> {
		if (this.#title !== undefined) {
			return
		}

		if (youTubeApiKey !== undefined) {
			let vid: string | undefined
			const url = new URL(this.url)
			if (url.hostname === 'youtu.be') {
				vid = url.pathname.slice(1)
			} else if (['www.youtube.com', 'youtube.com'].includes(url.hostname)) {
				vid = url.searchParams.get('v') ?? undefined
			}

			if (vid !== undefined) {
				this.url = youTubeVideoIdToUrl(vid)
				this.#title = await fetchYouTubeTitle(youTubeApiKey, vid)
				return
			}
		}

		this.#title = (await getTitle(this.url)) ?? '(タイトル取得失敗)'
		return
	}

	getTitle(): string {
		return this.#title ?? '(タイトル未取得)'
	}

	serialize(): z.infer<typeof SerializedYouTubeMusic> {
		return { kind: 'youtube', url: this.url, title: this.getTitle() }
	}

	toListString(): string {
		return `(youtube ${this.url}) ${this.getTitle()}`
	}

	select(): Music[] | undefined {
		return
	}

	createResource(): MusicPlayResource {
		const ytdl = spawn(ytdlPath, [
			'--no-playlist',
			'-f',
			'bestaudio*',
			'-o',
			'-',
			'--',
			this.url,
		])
		ytdl.stdin.end()
		ytdl.on('error', (err) => {
			console.error('YouTubeの再生中にエラー', err)
		})

		return {
			audioResource: voice.createAudioResource(ytdl.stdout),
			finalizer() {
				ytdl.kill()
			},
		}
	}

	static deserialize(data: unknown): YouTubeMusic {
		const res = SerializedYouTubeMusic.parse(data)
		return new YouTubeMusic(res.url, res.title)
	}
}

const ResourceId = z
	.object({
		kind: z.string(),
	})
	.passthrough()

const VideoResourceId = z.object({
	kind: z.literal('youtube#video'),
	videoId: z.string(),
})

const Snippet = z.object({
	title: z.string(),
	resourceId: ResourceId,
})

const Item = z.object({
	kind: z.literal('youtube#playlistItem'),
	snippet: Snippet,
})

const PlaylistItemsRes = z.object({
	nextPageToken: z.string().optional(),
	items: z.array(Item),
})

export async function fetchPlaylistItems(
	apiKey: string,
	playlistId: string
): Promise<YouTubeMusic[]> {
	const musics: YouTubeMusic[] = []
	let pageCount = 0

	let pageToken: string | undefined = undefined
	do {
		const url = new URL('https://youtube.googleapis.com/youtube/v3/playlistItems')
		const params = url.searchParams
		params.set('part', 'snippet')
		params.set('key', apiKey)
		params.set('playlistId', playlistId)
		params.set('maxResults', '50')
		if (pageToken !== undefined) {
			params.set('pageToken', pageToken)
		}

		const res = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
		})
		const json = PlaylistItemsRes.parse(await res.json())

		for (const item of json.items) {
			const res = VideoResourceId.safeParse(item.snippet.resourceId)
			if (res.success) {
				const videoUrl = youTubeVideoIdToUrl(res.data.videoId)
				musics.push(new YouTubeMusic(videoUrl, item.snippet.title))
			} else {
				console.log(res.error)
			}
		}
		pageToken = json.nextPageToken
		++pageCount
		console.log(pageCount)
	} while (pageToken !== undefined && pageCount <= 20)

	return musics
}

const VideoRes = z.object({
	items: z.tuple([
		z.object({
			kind: z.literal('youtube#video'),
			snippet: z.object({
				title: z.string(),
			}),
		}),
	]),
})

async function fetchYouTubeTitle(apiKey: string, videoId: string): Promise<string> {
	const url = new URL('https://youtube.googleapis.com/youtube/v3/videos')
	const params = url.searchParams
	params.set('part', 'snippet')
	params.set('key', apiKey)
	params.set('id', videoId)

	const res = await fetch(url.toString(), {
		method: 'GET',
		headers: {
			Accept: 'application/json',
		},
	})
	const json = VideoRes.parse(await res.json())
	return json.items[0].snippet.title
}
