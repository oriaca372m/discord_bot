class Channel {
	createChannelInstance(channel) {
		throw new Error('Not Implemented')
	}
}

class Guild {
	createGuildInstance(guild) {
		throw new Error('Not Implemented')
	}
}

class Command {
	async onCommand(msg, name, args) {
		throw new Error('Not Implemented')
	}
}

class Feature {
	#commands = []
	#guilds = []
	#channels = []

	#guildInstances = new Map()
	#channelInstances = new Map()

	#hasInitialized = false

	registerCommand(command) {
		this.#commands.push(command)
	}

	get commands() {
		return this.#commands
	}

	registerGuild(guild) {
		this.#guilds.push(guild)
	}

	get guilds() {
		return this.#guilds
	}

	registerChannel(channel) {
		this.#channels.push(channel)
	}

	get channels() {
		return this.#channels
	}

	async _dispatchBase(arr, map, id, createInstance) {
		arr.forEach((elm, idx) => {
			if (!map.has(id)) {
				map.set(id, new Map())
			}

			const mapOfId = map.get(id)
			if (!mapOfId.get(idx)) {
				mapOfId.set(idx, createInstance(elm))
			}
		})

		return map.values().map(x => x.values()).flat()
	}

	async _eachAsyncOf(arr, doWithX) {
		const errors = []

		await Promise.all(arr.map(x => {
			return async () => {
				try {
					await doWithX(x)
				} catch (e) {
					errors.push(e)
				}
			}
		}))

		if (errors.length !== 0) {
			throw errors
		}
	}

	async dispatchToChannels(channel, doWithInstance) {
		const channelInstances = this._dispatchBase(
			this.#channels,
			this.#channelInstances,
			x => x.createChannelInstance(channel))

		await this._eachAsyncOf(channelInstances, doWithInstance)
	}

	async dispatchToGuilds(guild, doWithInstance) {
		if (!guild) {
			return
		}

		const channelInstances = this._dispatchBase(
			this.#guilds,
			this.#guildInstances,
			x => x.createGuildInstance(guild))

		await this._eachAsyncOf(channelInstances, doWithInstance)
	}

	async dispatchToCommands(doWithInstance) {
		await this._eachAsyncOf(this.#commands, doWithInstance)
	}

	async onCommand(msg, name, args) {
		await this.dispatchToCommands(x => x.onCommand(msg, name, args))
	}

	async onMessage(msg) {
		await this.dispatchToChannels(msg.channel, x => x.onMessage(msg))
		await this.dispatchToGuilds(msg.guild, x => x.onMessage(msg))
	}

	hasInitialized() {
		return this.#hasInitialized
	}

	// init はこっちをオーバーライドして
	async initImpl() {
	}

	// オーバライドしないで
	async init(manager) {
		this.manager = manager
		await initImpl()
		this.hasInitialized = true
	}

	async finalize() {
	}
}

module.exports = { Channel, Guild, Command, Feature }
