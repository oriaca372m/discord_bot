import crypto from 'node:crypto'

export interface BasicAccessTokenInfo {
	// かぶらなきゃ何でもいい
	accessToken: string
}

function bufferToHex(buffer: Uint8Array): string {
	return [...buffer].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function createBasicAccessTokenInfo(): BasicAccessTokenInfo {
	const accessTokenBuf = new Uint8Array(16)

	crypto.randomFillSync(accessTokenBuf)
	const accessToken = bufferToHex(accessTokenBuf)

	return { accessToken }
}

export interface Authorizer {
	getBasicAccessTokenInfo(token: string): BasicAccessTokenInfo | undefined
}

export class BasicAuthorizer implements Authorizer {
	readonly #entries = new Map<string, BasicAccessTokenInfo>()

	createBasicAccessToken(): BasicAccessTokenInfo {
		const info = createBasicAccessTokenInfo()
		this.#entries.set(info.accessToken, info)
		return info
	}

	getBasicAccessTokenInfo(token: string): BasicAccessTokenInfo | undefined {
		return this.#entries.get(token)
	}
}
