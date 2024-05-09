import type { z } from 'zod'
import type { RpcFunc, RpcInterface } from './core'

export type RpcServerNeverFuncHandler<Context> = (
	context: Context,
	request: never
) => Promise<unknown>

export type RpcServerFuncHandler<Context, Func extends RpcFunc> = (
	context: Context,
	request: z.infer<Func[1]>
) => Promise<z.infer<Func[2]>>

export interface RpcServerFuncInfo<Context, Func extends RpcFunc = RpcFunc> {
	readonly rpcFunc: Func
	readonly handler: RpcServerNeverFuncHandler<Context>
}

export interface RpcServer<Context> {
	readonly interface: RpcInterface
	readonly funcs: Record<string, RpcServerFuncInfo<Context>>
	readonly children: Record<string, RpcServer<Context>>
}

export interface TypedRpcServer<Context, Iface extends RpcInterface> {
	readonly interface: Iface
	readonly funcs: Record<string, RpcServerFuncInfo<Context>>
	readonly children: Record<string, RpcServer<Context>>
}

type ValidFuncs<Context, Func extends RpcFunc> = Func extends RpcFunc
	? RpcServerFuncInfo<Context, Func>
	: never

type ValidChildren<Context, Child extends RpcInterface> = Child extends RpcInterface
	? TypedRpcServer<Context, Child>
	: never

type ValueOf<T> = T[keyof T]

export type BindContextRet<Context, Iface extends RpcInterface> = {
	f: <Name extends keyof Iface[1]['funcs']>(
		name: Name,
		handler: RpcServerFuncHandler<Context, Iface[1]['funcs'][Name]>
	) => RpcServerFuncInfo<Context, Iface[1]['funcs'][Name]>

	createRpcServer: <
		Funcs extends readonly ValidFuncs<Context, ValueOf<Iface[1]['funcs']>>[],
		Children extends readonly ValidChildren<Context, ValueOf<Iface[1]['children']>>[],
	>(
		handlers: Funcs,
		children: Children
	) => keyof Iface[1]['funcs'] | keyof Iface[1]['children'] extends
		| Funcs[number]['rpcFunc'][0]
		| Children[number]['interface'][0]
		? TypedRpcServer<Context, Iface>
		: undefined
}

export function bindContext<Context, Iface extends RpcInterface>(
	iface: Iface
): BindContextRet<Context, Iface> {
	return {
		f: (name, handler) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
			return { rpcFunc: iface[1].funcs[name as string] as any, handler }
		},
		createRpcServer: (funcs, children) => {
			return {
				interface: iface,
				funcs: Object.fromEntries(funcs.map((x) => [x.rpcFunc[0], x])),
				children: Object.fromEntries(children.map((x) => [x.interface[0], x])),
			} as TypedRpcServer<Context, Iface> & undefined
		},
	}
}

function mapObjectValues<K extends PropertyKey, V, T>(
	obj: Record<K, V>,
	fn: (x: V) => T
): Record<K, T> {
	return Object.fromEntries(Object.entries<V>(obj).map(([k, v]) => [k, fn(v)])) as Record<K, T>
}

export function adaptContext<Server extends RpcServer<never>>(
	server: Server
): Server extends TypedRpcServer<infer NewContext, infer Iface>
	? <Context>(converter: (ctx: Context) => NewContext) => TypedRpcServer<Context, Iface>
	: undefined {
	return (<Context>(converter: (ctx: Context) => unknown): RpcServer<Context> => {
		const newFuncs = mapObjectValues(server.funcs, (info) => ({
			...info,
			handler: (ctx: Context, req: never) => info.handler(converter(ctx) as never, req),
		}))
		const newChildren = mapObjectValues(server.children, (child) =>
			adaptContext(child)(converter as never)
		)

		return {
			interface: server.interface,
			funcs: newFuncs,
			children: newChildren,
		}
	}) as never
}
