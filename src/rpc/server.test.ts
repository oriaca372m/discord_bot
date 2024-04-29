import { z } from 'zod'
import { f, iface } from 'Src/rpc/core'
import { bindContext, type RpcServer } from './server'

describe('RpcServer', () => {
	const dummyIface = iface(
		'dummy',
		[
			f('say', z.object({ msg: z.string() }), z.object({ res: z.string() })),
			f('dumpContext', z.object({}), z.object({ val: z.string() })),
		],
		[]
	)

	class TestServer<Context> {
		constructor(readonly server: RpcServer<Context>) {}

		async handle(context: Context, name: string, req: unknown): Promise<unknown> {
			const info = this.server.funcs[name]
			if (info === undefined) {
				throw new Error('not found')
			}

			const [, reqType, resType] = info.rpcFunc
			const res = await info.handler(context, reqType.parse(req) as never)
			resType.parse(res)
			return res
		}
	}

	type Ctx = string
	const dummyServer = (() => {
		const { f, createRpcServer } = bindContext<Ctx, typeof dummyIface>(dummyIface)
		return createRpcServer(
			[
				f('say', (_ctx, req) => Promise.resolve({ res: `res ${req.msg}` })),
				f('dumpContext', (ctx, _req) => Promise.resolve({ val: ctx })),
			],
			[]
		)
	})()

	const context = 'ctx'
	const server = new TestServer<Ctx>(dummyServer)

	it('シグネチャに沿った入力が受け入れられること', async () => {
		const res = await server.handle(context, 'say', { msg: 'hello' })
		expect(res).toEqual({ res: 'res hello' })
	})

	it('シグネチャに沿わない入力が拒絶されること', async () => {
		await expect(server.handle(context, 'say', { hello: 'hello' })).rejects.toThrow()
	})

	it('期待したコンテキストを持っていること', async () => {
		const res = await server.handle(context, 'dumpContext', {})
		expect(res).toEqual({ val: 'ctx' })
	})
})
