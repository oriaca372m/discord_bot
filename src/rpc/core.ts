import type { z } from 'zod'

type NamedTuple = readonly [string, ...unknown[]]

type ToObj<T extends readonly NamedTuple[]> = { [U in T[number] as U[0]]: U }

export type RpcFunc = readonly [string, z.ZodType, z.ZodType]
export type RpcInterface = [
	string,
	{
		funcs: Record<string, RpcFunc>
		children: Record<string, RpcInterface>
	},
]

export type RpcRealFunc<T extends RpcFunc> = (req: z.infer<T[1]>) => Promise<z.infer<T[2]>>

export function f<Name extends string, Req extends z.ZodType, Res extends z.ZodType>(
	name: Name,
	req: Req,
	res: Res
): readonly [Name, Req, Res] {
	return [name, req, res]
}

function toObj<T extends readonly NamedTuple[]>(arr: T): ToObj<T> {
	return Object.fromEntries(arr.map((x) => [x[0], x])) as ToObj<T>
}

export function iface<
	Name extends string,
	Funcs extends readonly RpcFunc[],
	Children extends readonly RpcInterface[],
>(
	name: Name,
	funcs: Funcs,
	children: Children
): [
	Name,
	{
		funcs: ToObj<Funcs>
		children: ToObj<Children>
	},
] {
	return [
		name,
		{
			funcs: toObj(funcs),
			children: toObj(children),
		},
	]
}
