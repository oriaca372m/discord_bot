import type * as discordjs from 'discord.js'
import type { Response } from 'Src/features/custom-reply/config'

export interface Action {
	handle(msg: discordjs.Message, res: Response): Promise<ActionResult | undefined>
}

export interface ActionResult {
	text?: string
	options?: discordjs.MessageCreateOptions
}
