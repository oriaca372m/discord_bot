import type * as discordjs from 'discord.js'

import type { FeatureGlobalConfig } from 'Src/features/global-config'
import type { ObjectStorage } from 'Src/object-storage'
import * as utils from 'Src/utils'

export function isValidImageId(id: string): boolean {
	const validImageIdRegExp = /^[a-zA-Z0-9-_]{2,32}\.(png|jpg|jpeg|gif)$/
	return validImageIdRegExp.test(id)
}

export class Images {
	private _images: string[] = []
	private state = 'free'
	private imageName: string | undefined

	#objectStorage!: ObjectStorage

	constructor(private readonly gc: FeatureGlobalConfig) {}

	async init(storage: ObjectStorage): Promise<void> {
		this.#objectStorage = storage
		await storage.mkdir('.')
		await this.#reloadImages()
	}

	async #reloadImages(): Promise<void> {
		this._images = await this.#objectStorage.readDir()
		this._images.sort()
	}

	get images(): string[] {
		return this._images
	}

	#getImagePathById(id: string): string {
		return id
	}

	async getImageBufById(id: string): Promise<Buffer> {
		return this.#objectStorage.readFile(this.#getImagePathById(id))
	}

	async uploadCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (this.state === 'waitingImage') {
			await this.gc.send(msg, 'customReply.images.uploadingImageCancel')
			this.state = 'free'
		}

		const id = args[0]
		if (id === undefined) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(id)) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyValidIdAndSorry')
			return
		}

		this.imageName = id
		this.state = 'waitingImage'
		await this.gc.send(msg, 'customReply.images.readyToUpload')
	}

	async listCommand(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args: string[]
		let options: utils.Options

		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, ['s', 'search']))
		} catch (e) {
			await this.gc.send(msg, 'customReply.images.listInvalidCommand', {
				e,
			})
			return
		}

		const search = utils.getOption(options, ['s', 'search'])
		const images = search
			? this._images.filter((x) => new RegExp(search as string).test(x))
			: this._images

		if (images.length === 0) {
			await this.gc.send(msg, 'customReply.images.listImageNotFound')
			return
		}

		const pageNumber = (args[0] ? Number.parseInt(args[0], 10) : undefined) ?? 1

		// 1ページあたり何枚の画像を表示させるか
		const imagesPerPage = 20
		const maxPage = Math.ceil(images.length / imagesPerPage)

		if (pageNumber < 1 || maxPage < pageNumber) {
			await this.gc.send(msg, 'customReply.images.invalidPageId', {
				maxPage,
			})
			return
		}

		const pagedImages = images.slice(
			imagesPerPage * (pageNumber - 1),
			imagesPerPage * pageNumber
		)

		await this.gc.send(msg, 'customReply.images.list', {
			currentPage: pageNumber,
			maxPage,
			images: pagedImages.join('\n'),
		})
	}

	async removeCommand(args: string[], msg: discordjs.Message): Promise<void> {
		const id = args[0]
		if (id === undefined) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(id)) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		const index = this._images.indexOf(id)
		if (index === -1) {
			await this.gc.send(msg, 'customReply.images.imageIdThatDoesNotExist')
			return
		}

		this._images.splice(index)
		await this.#objectStorage.unlink(this.#getImagePathById(id))

		await this.gc.send(msg, 'customReply.images.removingComplete')
	}

	async previewCommand(args: string[], msg: discordjs.Message): Promise<void> {
		const id = args[0]
		if (id === undefined) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(id)) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!this._images.includes(id)) {
			await this.gc.send(msg, 'customReply.images.imageIdThatDoesNotExist')
			return
		}

		await this.gc.send(
			msg,
			'customReply.images.sendPreview',
			{},
			{
				files: [await this.getImageBufById(id)],
			}
		)
	}

	async reloadLocalCommand(_args: string[], msg: discordjs.Message): Promise<void> {
		await this.#reloadImages()
		await this.gc.send(msg, 'customReply.images.localReloadingComplete')
	}

	async command(args: string[], msg: discordjs.Message): Promise<void> {
		await utils.subCommandProxy(
			{
				upload: (a, m) => this.uploadCommand(a, m),
				list: (a, m) => this.listCommand(a, m),
				remove: (a, m) => this.removeCommand(a, m),
				preview: (a, m) => this.previewCommand(a, m),
				reloadLocal: (a, m) => this.reloadLocalCommand(a, m),
			},
			args,
			msg
		)
	}

	async processImageUpload(msg: discordjs.Message): Promise<void> {
		if (this.state === 'waitingImage') {
			const firstAttachment = msg.attachments.first()
			if (firstAttachment === undefined) {
				return
			}

			const imageName = this.imageName ?? utils.unreachable()

			const res = await fetch(firstAttachment.url)
			await this.#objectStorage.writeFile(
				this.#getImagePathById(imageName),
				Buffer.from(await res.arrayBuffer())
			)

			if (!this._images.includes(imageName)) {
				this._images.push(imageName)
				this._images.sort()
			}

			await this.gc.send(msg, 'customReply.images.uploadingComplete')
			this.state = 'free'
		}
	}
}
