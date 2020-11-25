import * as discordjs from 'discord.js'
import { Action, ActionResult } from 'Src/features/custom-reply/actions/action'
import { Response } from 'Src/features/custom-reply/config'

export class ActionDoNothing implements Action {
	handle(_msg: discordjs.Message, _res: Response): Promise<ActionResult | undefined> {
		return Promise.resolve(undefined)
	}
}
