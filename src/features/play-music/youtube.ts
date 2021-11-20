import * as voice from '@discordjs/voice'
import { spawn, execFile } from 'child_process'
import { Music } from './music'
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
			['--dump-json', '--', url],
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

export class YouTubeMusic implements Music {
	private _title!: string

	constructor(private _url: string) {
		utils.mustValidUrl(_url)
	}

	async init(): Promise<void> {
		this._title = (await getTitle(this._url)) ?? '(タイトル取得失敗)'
		return Promise.resolve()
	}

	getTitle(): string {
		return this._title
	}

	serialize(): SerializedYouTubeMusic {
		return { kind: 'youtube', url: this._url, title: this._title }
	}

	toListString(): string {
		return `(youtube ${this._url}) ${this.getTitle()}`
	}

	select(): Music[] | undefined {
		return
	}

	createResource(): [voice.AudioResource, (() => void) | undefined] {
		const ytdl = spawn(ytdlPath, ['-f', 'bestaudio*', '-o', '-', '--', this._url])
		ytdl.stdin.end()
		ytdl.on('error', (err) => {
			console.error('YouTubeの再生中にエラー', err)
		})

		return [
			voice.createAudioResource(ytdl.stdout),
			(): void => {
				ytdl.kill()
			},
		]
	}

	static deserialize(data: SerializedYouTubeMusic): YouTubeMusic {
		const m = new YouTubeMusic(data.url)
		m._title = data.title
		return m
	}
}
