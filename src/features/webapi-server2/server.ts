import type { z } from 'zod'
import http from 'node:http'
import type net from 'node:net'

import type { Authorizer, BasicAccessTokenInfo } from './authorizer'
import { HandlerError } from './context'

import type { RpcServer, RpcServerFuncInfo, RpcServerNeverFuncHandler } from 'Src/rpc/server'
import * as u from 'Src/utils'

interface RpcServerFuncTreeData<Context> {
	funcs: Map<string, RpcServerFuncInfo<Context>>
	children: Map<string, RpcServerFuncTreeData<Context>>
}

class RpcServerFuncTree<Context> {
	readonly #root: RpcServerFuncTreeData<Context> = { funcs: new Map(), children: new Map() }

	findFuncInfo(inPath: readonly string[]): RpcServerFuncInfo<Context> | undefined {
		const children = Array.from(inPath)
		const funcName = children.pop()

		if (funcName === undefined) {
			return
		}

		let tree = this.#root
		for (const name of children) {
			const child = tree.children.get(name)
			if (child === undefined) {
				return
			}
			tree = child
		}

		return tree.funcs.get(funcName)
	}

	registerRpcServer(rpcServer: RpcServer<Context>): void {
		this.#root.children.set(rpcServer.interface[0], this.#createTreeData(rpcServer))
	}

	#createTreeData(rpcServer: RpcServer<Context>): RpcServerFuncTreeData<Context> {
		const tree = { funcs: new Map(), children: new Map() }
		for (const func of Object.values(rpcServer.funcs)) {
			tree.funcs.set(func.rpcFunc[0], func)
		}

		for (const child of Object.values(rpcServer.children)) {
			tree.children.set(child.interface[0], this.#createTreeData(child))
		}

		return tree
	}
}

class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly responseMessage?: string | undefined
	) {
		super(responseMessage)
	}
}

export class WebApiServer<Context> {
	readonly #server: http.Server
	readonly #funcTree = new RpcServerFuncTree<Context>()

	constructor(
		private readonly authorizer: Authorizer,
		private readonly createContext: (accessToken: string, url: string) => Context
	) {
		this.#server = http.createServer((req, res) => {
			this.#handleRequest(req, res).catch((e: unknown) => {
				console.error('failed to handle request', e)
			})
		})
		this.#server.on('error', (e) => {
			console.error(e)
		})
	}

	registerRpcServer(rpcServer: RpcServer<Context>): void {
		this.#funcTree.registerRpcServer(rpcServer)
	}

	listen(port?: number | undefined, hostname?: string | undefined): Promise<number> {
		return new Promise((resolve) => {
			this.#server.once('listening', () => {
				resolve((this.#server.address() as net.AddressInfo).port)
			})
			this.#server.listen(port, hostname)
		})
	}

	close(): void {
		this.#server.close()
	}

	async #handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		if (req.method === 'OPTIONS') {
			res.writeHead(200, {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			})
			res.end()
			return
		}

		try {
			await this.#handleRequestMain(req, res)
		} catch (e) {
			if (e instanceof HttpError) {
				this.#writeErrorResponse(res, e.status, e.responseMessage)
			} else {
				console.error(e)
				this.#writeErrorResponse(res, 500)
			}
		}
	}

	async #handleRequestMain(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		if (req.method !== 'POST') {
			throw new HttpError(404)
		}

		const url = req.url ?? u.unreachable()
		const { handler, rpcFunc } = this.#findFuncInfo(url)
		const [, reqType, resType] = rpcFunc

		const ctx = this.createContext(this.#getAccessToken(req).accessToken, url)

		const checkedReq = await this.#parseRequest(req, reqType)
		const checkedRet = await this.#callFuncHandler(handler, ctx, checkedReq, resType)

		res.writeHead(200, {
			'Access-Control-Allow-Origin': '*',
		})
		res.end(JSON.stringify(checkedRet))
	}

	#findFuncInfo(url: string): RpcServerFuncInfo<Context> {
		const splitedUrl = url.split('/').toSpliced(0, 1)
		const funcInfo = this.#funcTree.findFuncInfo(splitedUrl)
		if (funcInfo === undefined) {
			throw new HttpError(404, 'A function not found!')
		}
		return funcInfo
	}

	#getAccessToken(req: http.IncomingMessage): BasicAccessTokenInfo {
		const authorization = req.headers.authorization
		if (authorization === undefined) {
			throw new HttpError(401)
		}

		const [type, credential] = authorization.split(' ')
		if (type !== 'Bearer' || credential === undefined) {
			throw new HttpError(401)
		}

		const tokenInfo = this.authorizer.getBasicAccessTokenInfo(credential)
		if (tokenInfo === undefined) {
			console.error('不正なアクセストークンを利用してのアクセス')
			throw new HttpError(401)
		}

		return tokenInfo
	}

	async #parseRequest(req: http.IncomingMessage, reqType: z.ZodType): Promise<never> {
		let message: unknown
		try {
			message = JSON.parse((await u.readAll(req)).toString())
		} catch (e: unknown) {
			console.error('怪しげなアクセス', e)
			throw new HttpError(400)
		}

		const parsedMsg = reqType.safeParse(message)
		if (!parsedMsg.success) {
			throw new HttpError(400, `Invalid message: ${parsedMsg.error.toString()}`)
		}

		return parsedMsg.data as never
	}

	async #callFuncHandler(
		handler: RpcServerNeverFuncHandler<Context>,
		context: Context,
		checkedReq: never,
		resType: z.ZodType
	): Promise<unknown> {
		let ret: unknown
		try {
			ret = await handler(context, checkedReq)
		} catch (e) {
			if (e instanceof HandlerError) {
				throw new HttpError(500, e.message)
			}
			throw e
		}

		const parsedRet = resType.safeParse(ret)
		if (!parsedRet.success) {
			console.error(parsedRet.error)
			throw new HttpError(500)
		}

		return parsedRet.data as unknown
	}

	#writeErrorResponse(res: http.ServerResponse, code: number, message?: string | undefined) {
		res.writeHead(code, {
			'Access-Control-Allow-Origin': '*',
		})
		if (message === undefined) {
			res.end()
		} else {
			res.end(JSON.stringify({ error: message }))
		}
	}
}
