import type * as discordjs from 'discord.js'
import type { Action, ActionResult } from 'Src/features/custom-reply/actions/action'
import type { Response } from 'Src/features/custom-reply/config'
import { type Images, isValidImageId } from 'Src/features/custom-reply/images'
import type { FeatureGlobalConfig } from 'Src/features/global-config'

export class ActionDefault implements Action {
	constructor(
		private readonly _images: Images,
		private readonly _gc: FeatureGlobalConfig
	) {}

	async handle(msg: discordjs.Message, res: Response): Promise<ActionResult | undefined> {
		const imageId = res.image
		if (imageId) {
			if (!isValidImageId(imageId)) {
				await this._gc.send(msg, 'customReply.invalidImageIdInResponse', { imageId })
				console.log(`無効な画像ID ${imageId}`)
				return
			}

			let img: Buffer
			try {
				img = await this._images.getImageBufById(imageId)
			} catch (_) {
				await this._gc.send(msg, 'customReply.imageIdThatDoesNotExist', { imageId })
				return
			}
			return { text: res.text, options: { files: [img] } }
		}

		return { text: res.text }
	}
}
