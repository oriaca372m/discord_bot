import * as discordjs from 'discord.js'
import { Action, ActionResult } from 'Src/features/custom-reply/actions/action'
import { Response } from 'Src/features/custom-reply/config'
import { Images, isValidImageId } from 'Src/features/custom-reply/images'
import { FeatureGlobalConfig } from 'Src/features/global-config'
import { promises as fs } from 'fs'

export class ActionDefault implements Action {
	constructor(private readonly _images: Images, private readonly _gc: FeatureGlobalConfig) {}

	async handle(msg: discordjs.Message, res: Response): Promise<ActionResult | undefined> {
		const imageId = res.image
		if (imageId) {
			if (!isValidImageId(imageId)) {
				await this._gc.send(msg, 'customReply.invalidImageIdInResponse', { imageId })
				console.log(`無効な画像ID ${imageId}`)
				return
			}
			const path = this._images.getImagePathById(imageId)
			try {
				await fs.access(path)
			} catch (_) {
				await this._gc.send(msg, 'customReply.imageIdThatDoesNotExist', { imageId })
				return
			}
			return { text: res.text, options: { files: [path] } }
		}

		return { text: res.text }
	}
}
