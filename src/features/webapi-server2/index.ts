import type * as discordjs from 'discord.js'

import type { WebApi2Context } from './context'
import { WebApiServer } from './server'
import { type BasicAccessTokenInfo, BasicAuthorizer } from './authorizer'

import { FeatureBase } from 'Src/features/feature'
import type { RpcServer } from 'Src/rpc/server'
import * as u from 'Src/utils'

export interface AdditionalAccessTokenInfo {
	channel: u.LikeTextChannel
	guild: discordjs.Guild
}

export interface AccessTokenInfo extends AdditionalAccessTokenInfo {
	basicInfo: BasicAccessTokenInfo
}

class AdditionalInfoAuthorizer extends BasicAuthorizer {
	readonly #additionalInfos = new Map<string, AccessTokenInfo>()

	createAccessTokenWithAdditionalInfo(
		additionalInfo: AdditionalAccessTokenInfo
	): AccessTokenInfo {
		const basicInfo = this.createBasicAccessToken()
		const info = {
			basicInfo,
			...additionalInfo,
		}
		this.#additionalInfos.set(basicInfo.accessToken, info)
		return info
	}

	getAdditionalAccessTokenInfo(token: string): AccessTokenInfo | undefined {
		return this.#additionalInfos.get(token)
	}
}

export class FeatureWebApiServer2 extends FeatureBase {
	readonly #webApiServer: WebApiServer<WebApi2Context>
	readonly #authorizer = new AdditionalInfoAuthorizer()
	readonly priority = 10000

	constructor(readonly port: number) {
		super()
		this.#webApiServer = new WebApiServer(this.#authorizer, (token, url) =>
			this.#createContext(token, url)
		)
	}

	createAccessToken(info: AdditionalAccessTokenInfo): AccessTokenInfo {
		return this.#authorizer.createAccessTokenWithAdditionalInfo(info)
	}

	#createContext(token: string, _url: string): WebApi2Context {
		const tokenInfo = this.#authorizer.getAdditionalAccessTokenInfo(token) ?? u.unreachable()
		return { guild: tokenInfo.guild, channel: tokenInfo.channel }
	}

	registerRpcServer(rpcServer: RpcServer<WebApi2Context>): void {
		this.#webApiServer.registerRpcServer(rpcServer)
	}

	async initImpl(): Promise<void> {
		await this.#webApiServer.listen(this.port)
	}

	finalize(): Promise<void> {
		this.#webApiServer.close()
		return Promise.resolve()
	}
}
