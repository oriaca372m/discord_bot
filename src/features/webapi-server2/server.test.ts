import { z } from 'zod'
import { f, iface } from 'Src/rpc/core'
import { bindContext } from 'Src/rpc/server'

import { WebApiServer } from './server'
import { BasicAuthorizer } from './authorizer'

describe('WebApiServer', () => {
	let server: WebApiServer<string>
	let port: number
	let accessToken: string

	beforeAll(async () => {
		const testIface = iface(
			'test',
			[
				f('hello', z.object({ in: z.string() }), z.object({ out: z.string() })),
				f('invalidRes', z.object({}), z.object({ out: z.string() })),
				f('echoAccessToken', z.object({}), z.object({ accessToken: z.string() })),
			],
			[]
		)

		type Ctx = string
		const testServer = (() => {
			const { f, createRpcServer } = bindContext<Ctx, typeof testIface>(testIface)
			return createRpcServer(
				[
					f('hello', (_ctx, req) => Promise.resolve({ out: `${req.in} world` })),
					f('invalidRes', () => Promise.resolve({ msg: 'invalid res' } as never)),
					f('echoAccessToken', (ctx) => Promise.resolve({ accessToken: ctx })),
				],
				[]
			)
		})()

		const authorizer = new BasicAuthorizer()
		accessToken = authorizer.createBasicAccessToken().accessToken

		server = new WebApiServer<string>(authorizer, (token) => token)
		server.registerRpcServer(testServer)
		port = await server.listen()
	})

	afterAll(() => {
		server.close()
	})

	const callApi = async (path: string, req: unknown): Promise<Response> =>
		await fetch(`http://localhost:${port}/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Access-Token': accessToken },
			body: JSON.stringify(req),
		})

	it('関数が呼び出せること', async () => {
		const res = await callApi('test/hello', { in: 'hello' })
		expect(await res.json()).toEqual({ out: 'hello world' })
	})

	it('不正な引数を渡すと400エラーを返すこと', async () => {
		const res = await callApi('test/hello', { msg: 'hello' })
		expect(res.status).toBe(400)
	})

	it('不正な戻り値が500エラーを返すこと', async () => {
		const res = await callApi('test/invalidRes', {})
		expect(res.status).toBe(500)
	})

	it('アクセストークンを正しく渡せること', async () => {
		const res = await callApi('test/echoAccessToken', {})
		expect(await res.json()).toEqual({ accessToken })
	})

	it('存在しないアクセストークンで401エラーを返すこと', async () => {
		const res = await fetch(`http://localhost:${port}/test/hello`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Access-Token': 'invalid access token',
			},
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(401)
	})
})
