import { execFile } from 'child_process'
import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as discordjs from 'discord.js'

import { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'
import { Mondai, MondaiConfig } from 'Src/features/mondai'
import { generateImageMap } from 'Src/features/mondai/image-map'

export type GameOption = {
	repeat?: boolean
	life?: number
}

type GameMode = string

function generateMondaiImage(
	mode: string,
	inPath: string,
	outPath: string,
	opts: { [_: string]: string } = {}
): Promise<{ [_: string]: string }> {
	const optArgs: string[] = []
	for (const key of Object.keys(opts)) {
		optArgs.push(`-${key}`)
		optArgs.push(opts[key])
	}

	return new Promise((resolve, reject) => {
		const args: ReadonlyArray<string> = [...optArgs, mode, inPath, outPath]
		execFile('./tools/mondai.rb', args, {}, (error: Error | null, stdout: string | Buffer) => {
			if (error) {
				reject(error)
			}
			try {
				resolve(JSON.parse(stdout as string) as { [_: string]: string })
			} catch (e) {
				reject(e)
			}
		})
	})
}

function normalizeAnswerMessage(message: string): string {
	const replaceTables: [RegExp, string][] = [[/\s+/g, ' ']]
	const replaced = replaceTables.reduce((a, i) => a.replace(i[0], i[1]), message)
	return replaced.normalize('NFKC')
}

type Answer = {
	title: string
	time: string
	pattern: string
}

export class Game {
	private readonly incorrectImageLog: { filename: string; answer: Answer }[] = []
	private answer: Answer | undefined
	private incorrectCount = 0
	private correctCount = 0
	private processing = false
	private tmpDir: string | undefined

	constructor(
		private readonly channelInstance: Mondai,
		private readonly gc: FeatureGlobalConfig,
		private readonly mode: GameMode,
		private readonly options: GameOption
	) {}

	private get config(): MondaiConfig {
		return this.channelInstance.config
	}

	private get isRepeat(): boolean {
		return this.options.repeat ?? false
	}

	private get incorrectLimit(): number {
		return this.options.life ?? 3
	}

	private get isAudioMode(): boolean {
		const audioModes = ['audio', 'music', 'intro']
		return audioModes.includes(this.mode)
	}

	private get isMosaicMode(): boolean {
		return this.mode === 'mosaic'
	}

	private getTmpPath(filename: string): string {
		return path.join(this.tmpDir ?? utils.unreachable(), filename)
	}

	private async postMondai(): Promise<void> {
		const outputPath = this.getTmpPath(this.isAudioMode ? 'audio.mp3' : 'image.jpg')

		await utils.retry(
			async () => {
				const episode = utils.randomPick(this.config.episodes)
				const options: { [_: string]: string } = {}
				if (this.isMosaicMode) {
					const mosaicOriginalPath = path.join(
						this.tmpDir ?? utils.unreachable(),
						'original.jpg'
					)
					options.o = mosaicOriginalPath
				}
				if (episode.excludeRange) {
					options.r = episode.excludeRange
				}

				try {
					const res = await generateMondaiImage(
						this.mode,
						episode.filename,
						outputPath,
						options
					)

					this.answer = {
						title: episode.title,
						pattern: episode.pattern,
						time: res.time,
					}
				} catch (e) {
					// TODO: 特別なエラー型にラップする
					throw Error(e as string)
				}
			},
			5,
			{ logging: true }
		)

		await this.gc.sendToChannel(
			this.channelInstance.channel,
			'mondai.sendMondaiImage',
			{},
			{ files: [outputPath] }
		)
	}

	async init(): Promise<void> {
		this.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mondai-'))
		this.processing = true
		await this.postMondai()
		this.processing = false
	}

	async _postResultMessage(
		msg: discordjs.Message,
		key: string,
		ans: Answer,
		title: string
	): Promise<void> {
		const options: discordjs.MessageCreateOptions = {}
		if (this.isMosaicMode) {
			options.files = [this.getTmpPath('original.jpg')]
		}

		await this.gc.send(
			msg,
			`mondai.answer.${key}`,
			{ title, time: ans.time, mosaic: this.isMosaicMode },
			options
		)
	}

	private async pushIncorrectImageLog(): Promise<void> {
		if (!this.isAudioMode && this.isRepeat) {
			const filename = this.getTmpPath(`incorrect${this.incorrectCount}.jpg`)
			await fs.copyFile(this.getTmpPath('image.jpg'), filename)
			this.incorrectImageLog.push({ filename, answer: this.answer ?? utils.unreachable() })
		}
	}

	private async processAnswerMessage(msg: discordjs.Message): Promise<boolean> {
		const text = normalizeAnswerMessage(msg.content)
		const ans = this.answer ?? utils.unreachable()
		const title = ans.title

		// 正解
		const correctMatch = new RegExp(ans.pattern, 'i').exec(text)
		if (correctMatch && correctMatch[0] === text) {
			await this._postResultMessage(msg, 'correct', ans, title)

			if (this.isRepeat) {
				this.correctCount++
				await this.postMondai()
				return true
			}

			return false
		}

		// 降参
		if (new RegExp(this.config.options.surrenderPattern, 'i').test(text)) {
			this.incorrectCount++
			await this.pushIncorrectImageLog()

			if (this.isRepeat && this.incorrectCount === this.incorrectLimit) {
				await this._postResultMessage(msg, 'reachedIncorrectLimit', ans, title)
				return false
			}

			await this._postResultMessage(msg, 'surrender', ans, title)

			if (this.isRepeat) {
				await this.postMondai()
				return true
			}

			return false
		}

		// 不正解
		for (const episode of this.config.episodes) {
			const incorrectMatch = new RegExp(episode.pattern, 'i').exec(text)
			if (incorrectMatch && incorrectMatch[0] === text) {
				this.incorrectCount++

				if (this.incorrectCount === this.incorrectLimit) {
					await this.pushIncorrectImageLog()
					await this._postResultMessage(msg, 'reachedIncorrectLimit', ans, title)
					return false
				}

				await this.gc.send(msg, 'mondai.answer.incorrect')

				return true
			}
		}

		return true
	}

	// true なら続行
	async onMessage(msg: discordjs.Message): Promise<boolean> {
		if (msg.author.bot || this.processing) {
			return true
		}

		this.processing = true
		const res = await this.processAnswerMessage(msg)
		this.processing = false
		return res
	}

	async finalize(isError = false): Promise<void> {
		if (isError && this.answer !== undefined) {
			await this.gc.sendToChannel(this.channelInstance.channel, 'mondai.onErrorExit', {
				title: this.answer.title,
				time: this.answer.time,
			})
		}

		if (this.isRepeat) {
			await this.gc.sendToChannel(this.channelInstance.channel, 'mondai.repeatResult', {
				correctCount: this.correctCount,
			})
			if (!this.isAudioMode && 10 <= this.correctCount && 0 < this.incorrectImageLog.length) {
				const buf = await generateImageMap(
					1920,
					1080,
					this.incorrectImageLog.map((x) => x.filename)
				)
				await this.gc.sendToChannel(
					this.channelInstance.channel,
					'mondai.incorrectImageMap',
					{ answers: this.incorrectImageLog.map((x) => x.answer) },
					{ files: [buf] }
				)
			}
		}

		if (this.tmpDir !== undefined) {
			await fs.rm(this.tmpDir, { recursive: true })
		}
	}
}
