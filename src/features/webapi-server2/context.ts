import type * as discordjs from 'discord.js'

import type * as u from 'Src/utils'

export interface WebApi2Context {
	channel: u.LikeTextChannel
	guild: discordjs.Guild
}

export class HandlerError extends Error {}
