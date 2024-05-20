import { z } from 'zod'
import { f, iface } from './core'
import type { RpcFunc, RpcInterface } from './core'
import { type RpcClientContext, type RpcClient, createRpcClient } from './client'

const testIface = iface(
	'test',
	[
		f(
			'addUrlToPlaylist',
			z.object({ url: z.string() }),
			z.object({ added: z.array(z.object({ kind: z.string() })) })
		),
	],
	[]
)

describe('RpcClient', () => {
	class TestCtx implements RpcClientContext {
		readonly resTable: Record<string, unknown> = {}

		addResponse(name: string, res: unknown): void {
			this.resTable[name] = res
		}

		async callFunc([name, reqType, resType]: RpcFunc, req: unknown): Promise<unknown> {
			reqType.parse(req)

			const res = this.resTable[name]
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const parsedRes = resType.parse(res)

			return (await parsedRes) as unknown
		}

		childContext(_iface: RpcInterface): this {
			return this
		}
	}

	let ctx: TestCtx
	let testClient: RpcClient<TestCtx, typeof testIface>

	beforeEach(() => {
		ctx = new TestCtx()
		testClient = createRpcClient(ctx, testIface)
	})

	test('シグネチャに沿った戻り値が帰ってくること', async () => {
		const expected = { added: [{ kind: 'youtube' }] }
		ctx.addResponse('addUrlToPlaylist', expected)
		expect(await testClient.addUrlToPlaylist({ url: 'https://youtu.be/' })).toEqual(expected)
	})

	test('シグネチャに沿わない戻り値が帰ってこないこと', async () => {
		ctx.addResponse('addUrlToPlaylist', { added: { kind: 'youtube' } })
		await expect(testClient.addUrlToPlaylist({ url: 'https://youtu.be/' })).rejects.toThrow()
	})
})
