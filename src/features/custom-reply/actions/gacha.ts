import type * as discordjs from 'discord.js'
import type { Action, ActionResult } from 'Src/features/custom-reply/actions/action'
import type { Response } from 'Src/features/custom-reply/config'
import type { Images } from 'Src/features/custom-reply/images'
import type { FeatureGlobalConfig } from 'Src/features/global-config'
import * as utils from 'Src/utils'

export class ActionGacha implements Action {
	constructor(
		private readonly _images: Images,
		private readonly _gc: FeatureGlobalConfig
	) {}

	async handle(msg: discordjs.Message, res: Response): Promise<ActionResult | undefined> {
		let list = this._images.images
		const pattern = res.pattern
		if (pattern !== undefined) {
			list = list.filter((x) => new RegExp(pattern).test(x))
		}

		if (list.length === 0) {
			await this._gc.send(msg, 'customReply.gachaImageNotFound')
			return
		}

		return {
			text: res.text,
			options: { files: [await this._images.getImageBufById(utils.randomPick(list))] },
		}
	}
}
