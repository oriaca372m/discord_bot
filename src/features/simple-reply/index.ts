import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'

export class FeatureSimpleReply extends CommonFeatureBase {
	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		if (msg.content === 'ping') {
			await msg.reply('Pong!')
		}

		if (msg.content.includes('チノちゃんかわいい')) {
			await msg.reply({ content: 'わかる', files: ['./assets/chino.png'] })
		}
	}
}
