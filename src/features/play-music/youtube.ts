import * as voice from '@discordjs/voice'
import { spawn, execFile } from 'child_process'
import { Music, MusicPlayResource } from './music'
import * as utils from 'Src/utils'

const ytdlPath = 'yt-dlp'

export interface SerializedYouTubeMusic {
	kind: 'youtube'
	url: string
	title: string
}

interface YtdlJson {
	title?: unknown
}

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
					const json = JSON.parse(stdout as string) as YtdlJson
					const title = json.title
					if (typeof title === 'string') {
						resolve(title)
					}
				} catch (e) {
					reject(e)
				}

				resolve(undefined)
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
		private _url: string,
		title?: string
	) {
		utils.mustValidUrl(_url)
		this.#title = title
	}

	async init(youTubeApiKey: string | undefined): Promise<void> {
		if (this.#title !== undefined) {
			return
		}

		if (youTubeApiKey !== undefined) {
			let vid: string | undefined
			const url = new URL(this._url)
			if (url.hostname === 'youtu.be') {
				vid = url.pathname.slice(1)
			} else if (['www.youtube.com', 'youtube.com'].includes(url.hostname)) {
				vid = url.searchParams.get('v') ?? undefined
			}

			if (vid !== undefined) {
				this._url = youTubeVideoIdToUrl(vid)
				this.#title = await fetchYouTubeTitle(youTubeApiKey, vid)
				return
			}
		}

		this.#title = (await getTitle(this._url)) ?? '(タイトル取得失敗)'
		return
	}

	getTitle(): string {
		return this.#title ?? '(タイトル未取得)'
	}

	serialize(): SerializedYouTubeMusic {
		return { kind: 'youtube', url: this._url, title: this.getTitle() }
	}

	toListString(): string {
		return `(youtube ${this._url}) ${this.getTitle()}`
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
			this._url,
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

	static deserialize(data: SerializedYouTubeMusic): YouTubeMusic {
		return new YouTubeMusic(data.url, data.title)
	}
}

interface PlaylistItemsRes {
	nextPageToken?: string
	items: Item[]
}

interface Item {
	snippet: Snippet
}

interface Snippet {
	title: string
	resourceId: ResourceId & VideoResourceId
}

interface ResourceId {
	kind: string
}

interface VideoResourceId {
	kind: 'youtube#video'
	videoId: string
}

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
		const json = (await res.json()) as PlaylistItemsRes

		for (const item of json.items) {
			if (item.snippet.resourceId.kind !== 'youtube#video') {
				continue
			}

			const videoUrl = youTubeVideoIdToUrl(item.snippet.resourceId.videoId)
			musics.push(new YouTubeMusic(videoUrl, item.snippet.title))
		}
		pageToken = json.nextPageToken
		++pageCount
		console.log(pageCount)
	} while (pageToken !== undefined && pageCount <= 20)

	return musics
}

interface VideoRes {
	items: Item[]
}

export async function fetchYouTubeTitle(apiKey: string, videoId: string): Promise<string> {
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
	const json = (await res.json()) as VideoRes

	if (json.items.length !== 1) {
		utils.unreachable()
	}

	return json.items[0].snippet.title
}
