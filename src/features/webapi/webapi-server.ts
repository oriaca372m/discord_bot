import http from 'http'
import * as msgpack from '@msgpack/msgpack'
import { Authorizer, BasicAccessTokenInfo } from 'Src/features/webapi/authorizer'
import { bufferToHex, hexToBuffer, encrypt, decrypt } from 'Src/features/webapi/utils'
import pako from 'pako'
import * as utils from 'Src/utils'

interface Message {
	sequenceId: number
	payload: unknown
}

function isMessage(v: unknown): v is Message {
	const msg = v as Message

	if (typeof msg !== 'object') {
		return false
	}

	if (!('payload' in msg)) {
		return false
	}

	if (typeof msg.sequenceId !== 'number') {
		return false
	}

	return true
}

export class WebApiServer {
	private readonly _server: http.Server

	constructor(
		private readonly _port: number,
		private readonly _authorizer: Authorizer,
		private readonly _recievedMessageHandler: (
			accessToken: string,
			payload: unknown
		) => Promise<unknown>
	) {
		this._server = http.createServer((req, res) => void this._handleRequest(req, res))
		this._server.on('error', (e) => console.error(e))
	}

	private _getAccessToken(req: http.IncomingMessage): BasicAccessTokenInfo | undefined {
		const accessToken = req.headers['x-access-token']
		if (typeof accessToken !== 'string') {
			return
		}

		return this._authorizer.getBasicAccessTokenInfo(accessToken)
	}

	private _writeErrorResponse(res: http.ServerResponse, code: number) {
		res.writeHead(code, {
			'Access-Control-Allow-Origin': '*',
		})
		res.end()
	}

	private async _handleRequestMain(
		req: http.IncomingMessage,
		res: http.ServerResponse
	): Promise<void> {
		const tokenInfo = this._getAccessToken(req)
		if (tokenInfo === undefined) {
			console.error('不正なアクセストークンを利用してのアクセス')
			this._writeErrorResponse(res, 401)
			return
		}

		// リクエストの復号化
		const encrypted = new Uint8Array(await utils.readAll(req))
		const key = tokenInfo.accessTokenSecret
		const iv = hexToBuffer(req.headers['x-iv'] as string)
		const decrypted = decrypt(encrypted, key, iv)

		const message = msgpack.decode(pako.inflateRaw(decrypted))
		if (!isMessage(message)) {
			console.error('怪しげなアクセス')
			this._writeErrorResponse(res, 400)
			return
		}

		if (message.sequenceId <= tokenInfo.sequenceId) {
			console.error('不正なシーケンスIDを利用してのアクセス')
			this._writeErrorResponse(res, 401)
			return
		}
		tokenInfo.sequenceId = message.sequenceId + 1

		// レスポンスの作成
		const resMessage: Message = {
			sequenceId: tokenInfo.sequenceId,
			payload: await this._recievedMessageHandler(tokenInfo.accessToken, message.payload),
		}

		const content = pako.deflateRaw(msgpack.encode(resMessage))
		const [resIv, resEncrypted] = encrypt(content, key)

		res.writeHead(200, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Expose-Headers': 'X-IV',
			'X-IV': bufferToHex(resIv),
		})
		res.write(resEncrypted)
		res.end()
	}

	private async _handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse
	): Promise<void> {
		if (req.method === 'OPTIONS') {
			res.writeHead(200, {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST',
				'Access-Control-Allow-Headers': 'Content-Type, X-Access-Token, X-IV',
			})
			res.end()
			return
		}

		if (req.method !== 'POST') {
			this._writeErrorResponse(res, 400)
			return
		}

		try {
			await this._handleRequestMain(req, res)
		} catch (e) {
			console.error(e)
			this._writeErrorResponse(res, 500)
			return
		}
	}

	listen(): void {
		this._server.listen(this._port, '127.0.0.1')
	}

	close(): void {
		this._server.close()
	}
}
