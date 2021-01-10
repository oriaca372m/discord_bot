import * as discordjs from 'discord.js'

import { FeatureBase } from 'Src/features/feature'

import { WebApiServer } from 'Src/features/webapi/webapi-server'
import { BasicAuthorizer } from 'Src/features/webapi/authorizer'
import { bufferToHex } from 'Src/features/webapi/utils'

export interface Handler {
	name(): string
	description(): string
	command(msg: discordjs.Message, args: string[]): Promise<void>
}

export class FeatureWebApi extends FeatureBase {
	private readonly _handlers: Handler[] = []
	private readonly _webApiServer: WebApiServer
	private readonly _authorizer = new BasicAuthorizer()
	readonly priority = 10000

	constructor() {
		super()

		const info = this._authorizer.createNewAccessToken()
		console.log(info.accessToken)
		console.log(bufferToHex(info.accessTokenSecret))

		this._webApiServer = new WebApiServer(
			this._authorizer,
			async (token, msg) => await this._onMessage(token, msg)
		)
	}

	private _onMessage(token: string, msg: unknown): Promise<unknown> {
		console.log(token)
		console.log(msg)
		return Promise.resolve({ text: 'I got this message!', msg })
	}

	registerHandler(handler: Handler): void {
		this._handlers.push(handler)
	}

	initImpl(): Promise<void> {
		this._webApiServer.listen()
		return Promise.resolve()
	}

	finalize(): Promise<void> {
		this._webApiServer.close()
		return Promise.resolve()
	}
}
