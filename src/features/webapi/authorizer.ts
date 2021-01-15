import crypto from 'crypto'
import { bufferToHex } from 'Src/features/webapi/utils'

export interface BasicAccessTokenInfo {
	// かぶらなきゃ何でもいい
	accessToken: string
	// 16バイトのシークレット
	accessTokenSecret: Uint8Array
	sequenceId: number
}

export function createBasicAccessTokenInfo(): BasicAccessTokenInfo {
	const accessTokenBuf = new Uint8Array(16)
	const accessTokenSecret = new Uint8Array(16)

	crypto.randomFillSync(accessTokenBuf)
	crypto.randomFillSync(accessTokenSecret)
	const accessToken = bufferToHex(accessTokenBuf)

	const info: BasicAccessTokenInfo = {
		accessToken,
		accessTokenSecret,
		sequenceId: 0,
	}

	return info
}

export interface Authorizer {
	getBasicAccessTokenInfo(token: string): BasicAccessTokenInfo | undefined
}

export class BasicAuthorizer implements Authorizer {
	private readonly _entries = new Map<string, BasicAccessTokenInfo>()

	createBasicAccessToken(): BasicAccessTokenInfo {
		const info = createBasicAccessTokenInfo()
		this._entries.set(info.accessToken, info)
		return info
	}

	getBasicAccessTokenInfo(token: string): BasicAccessTokenInfo | undefined {
		return this._entries.get(token)
	}
}
