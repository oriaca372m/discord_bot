import type { RpcFunc, RpcInterface } from './core'
import { type RpcClientContext, type RpcClient, createRpcClient } from './client'

import { playMusicIface } from 'Src/features/play-music/rpc-interface'

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
	let playMusic: RpcClient<TestCtx, typeof playMusicIface>

	beforeEach(() => {
		ctx = new TestCtx()
		playMusic = createRpcClient(ctx, playMusicIface)
	})

	test('シグネチャに沿った戻り値が帰ってくること', async () => {
		const expected = { added: [{ kind: 'youtube' }] }
		ctx.addResponse('addUrlToPlaylist', expected)
		expect(await playMusic.addUrlToPlaylist({ url: 'https://youtu.be/' })).toEqual(expected)
	})

	test('シグネチャに沿わない戻り値が帰ってこないこと', async () => {
		ctx.addResponse('addUrlToPlaylist', { added: { kind: 'youtube' } })
		await expect(playMusic.addUrlToPlaylist({ url: 'https://youtu.be/' })).rejects.toThrow()
	})
})
