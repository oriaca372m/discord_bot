import * as discordjs from 'discord.js'

import { FeatureBase } from 'Src/features/feature'

import { WebApiServer } from 'Src/features/webapi/webapi-server'
import { BasicAccessTokenInfo, BasicAuthorizer } from 'Src/features/webapi/authorizer'
import * as utils from 'Src/utils'

export interface WebApiHandler {
	methodName: string
	handle(args: unknown): Promise<unknown>
}

export interface AdditionalAccessTokenInfo {
	channel: utils.LikeTextChannel
	guild: discordjs.Guild
}

export interface AccessTokenInfo extends AdditionalAccessTokenInfo {
	basicInfo: BasicAccessTokenInfo
}

class AdditionalInfoAuthorizer extends BasicAuthorizer {
	private readonly _additionalInfos = new Map<string, AccessTokenInfo>()

	createAccessTokenWithAdditionalInfo(
		additionalInfo: AdditionalAccessTokenInfo
	): AccessTokenInfo {
		const basicInfo = this.createBasicAccessToken()
		const info = {
			basicInfo,
			...additionalInfo,
		}
		this._additionalInfos.set(basicInfo.accessToken, info)
		return info
	}

	getAdditionalAccessTokenInfo(token: string): AccessTokenInfo | undefined {
		return this._additionalInfos.get(token)
	}
}

interface MethodCallMessage {
	method: string
	args: unknown
}

function isMethodCallMessage(v: unknown): v is MethodCallMessage {
	const msg = v as MethodCallMessage

	if (typeof msg !== 'object') {
		return false
	}

	if (!('args' in msg)) {
		return false
	}

	if (typeof msg.method !== 'string') {
		return false
	}

	return true
}

export class FeatureWebApi extends FeatureBase {
	private readonly _handlers = new Map<string, WebApiHandler>()
	private readonly _webApiServer: WebApiServer
	private readonly _authorizer = new AdditionalInfoAuthorizer()
	readonly priority = 10000

	constructor(private readonly _port: number) {
		super()
		this._webApiServer = new WebApiServer(
			this._port,
			this._authorizer,
			async (token, msg) => await this._onMessage(token, msg)
		)
	}

	createAccessToken(info: AdditionalAccessTokenInfo): AccessTokenInfo {
		return this._authorizer.createAccessTokenWithAdditionalInfo(info)
	}

	private async _onMessage(token: string, msg: unknown): Promise<unknown> {
		console.log(token)
		console.log(msg)

		if (isMethodCallMessage(msg)) {
			const handler = this._handlers.get(msg.method)
			if (handler === undefined) {
				return { error: `The method '${msg.method} not found!'` }
			}

			try {
				return await handler.handle(msg.args)
			} catch (e) {
				console.error(e)
				return { error: 'Internal server error.' }
			}
		}

		return { error: "Couldn't recognize a method call!" }
	}

	registerHandler(handler: WebApiHandler): void {
		this._handlers.set(handler.methodName, handler)
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
