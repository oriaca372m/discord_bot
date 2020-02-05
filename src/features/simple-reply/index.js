const { Attachment } = require('discord.js')
const { Feature } = require('../feature.js')

class SimpleReply {
	constructor(feature) {
		this.feature = feature
	}

	async onMessage(msg) {
		if (msg.content === 'ping') {
			msg.reply('Pong!')
		}

		if (msg.content.indexOf('チノちゃんかわいい') !== -1) {
			const attachment = new Attachment('./assets/chino.png')
			msg.reply('わかる', { file: attachment })
		}
	}
}

module.exports = class extends Feature {
	async initImpl() {
		this.registerChannel(this)
	}

	createChannelInstance(channel) {
		return new SimpleReply(this, channel)
	}
}
