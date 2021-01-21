import { WebApiHandler, AccessTokenInfo } from 'Src/features/webapi'

import { FeatureCustomReply } from 'Src/features/custom-reply'

interface GetConifgListReq {}
interface GetConfigListRes {
	configNames: string[]
}

export class GetConfigList implements WebApiHandler {
	readonly methodName = 'custom-reply/get-config-list'

	constructor(private readonly _feature: FeatureCustomReply) {}

	handle(_req: GetConifgListReq, token: AccessTokenInfo): Promise<GetConfigListRes> {
		const config = this._feature.getChannelInstance(token.channel).config
		return Promise.resolve({ configNames: config.getConifgNames() })
	}
}
