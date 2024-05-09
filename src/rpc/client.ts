import type { RpcFunc, RpcInterface, RpcRealFunc } from './core'

type FuncProps<Funcs extends Record<string, RpcFunc>> = {
	readonly [K in keyof Funcs]: RpcRealFunc<Funcs[K]>
}

type ChildProps<Context extends RpcClientContext, Children extends Record<string, RpcInterface>> = {
	readonly [K in keyof Children]: RpcClient<ReturnType<Context['childContext']>, Children[K]>
}

type ContextProp<Context> = { readonly context: Context }

export type RpcClient<Context extends RpcClientContext, IF extends RpcInterface> = FuncProps<
	IF[1]['funcs']
> &
	ChildProps<Context, IF[1]['children']> &
	ContextProp<Context>

export interface RpcClientContext {
	callFunc(rpcFunc: RpcFunc, req: unknown): Promise<unknown>
	childContext(rpcInterface: RpcInterface): RpcClientContext
}

export function createRpcClient<Context extends RpcClientContext, Iface extends RpcInterface>(
	context: Context,
	iface: Iface
): RpcClient<Context, Iface> {
	const funcs = Object.values(iface[1].funcs).map((rpcFunc) => [
		rpcFunc[0],
		(req: unknown) => context.callFunc(rpcFunc, req),
	])
	const children = Object.values(iface[1].children).map((rpcIface) => [
		rpcIface[0],
		createRpcClient(context.childContext(rpcIface), rpcIface),
	])
	return Object.fromEntries([...funcs, ...children, ['context', context]]) as RpcClient<
		Context,
		Iface
	>
}
