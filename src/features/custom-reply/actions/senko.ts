import type * as discordjs from 'discord.js'
import type { Action, ActionResult } from 'Src/features/custom-reply/actions/action'
import type { Response } from 'Src/features/custom-reply/config'
import * as utils from 'Src/utils'
import lodash from 'lodash'

export class ActionSenko implements Action {
	handle(_msg: discordjs.Message, _res: Response): Promise<ActionResult | undefined> {
		const chars = 'せんここうやん'.split('')
		const generated = lodash
			.range(chars.length)
			.map(() => utils.randomPick(chars))
			.join('')

		return Promise.resolve<ActionResult>({ text: `${generated}!` })
	}
}
