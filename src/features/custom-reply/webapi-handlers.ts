import { WebApiHandler, AccessTokenInfo, HandlerError } from 'Src/features/webapi'

import { FeatureCustomReply } from 'Src/features/custom-reply'

interface GetConifgListReq {}
interface GetConfigListRes {
	configIds: string[]
}

export class GetConfigList implements WebApiHandler {
	readonly methodName = 'custom-reply/get-config-list'

	constructor(private readonly _feature: FeatureCustomReply) {}

	handle(_req: GetConifgListReq, token: AccessTokenInfo): Promise<GetConfigListRes> {
		const config = this._feature.getChannelInstance(token.channel).config
		return Promise.resolve({ configIds: config.getConifgIds() })
	}
}

interface GetConifgReq {
	id: string
}
interface GetConfigRes {
	text: string
}

export class GetConfig implements WebApiHandler {
	readonly methodName = 'custom-reply/get-config'

	constructor(private readonly _feature: FeatureCustomReply) {}

	handle(req: GetConifgReq, token: AccessTokenInfo): Promise<GetConfigRes> {
		const config = this._feature.getChannelInstance(token.channel).config
		const text = config.getConifg(req.id)
		if (text === undefined) {
			throw new HandlerError('no such a config.')
		}
		return Promise.resolve({ text })
	}
}
