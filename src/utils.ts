import lodash from 'lodash'
import stream from 'stream'
import * as discordjs from 'discord.js'

export function unreachable(): never
export function unreachable(_: never): never

export function unreachable(_?: unknown): never {
	throw Error('This must never happen!')
}

export function mustExist<T>(v: T | undefined | null): asserts v is T {
	if (v === undefined || v === null) {
		throw Error('undefined or null')
	}
}

export function mustString(v: unknown): asserts v is string {
	if (typeof v !== 'string') {
		throw Error('not string')
	}
}

export function parseShellLikeCommand(string: string): string[] | undefined {
	let state: 'normal' | 'singlequote' | 'doublequote' | 'backslash' = 'normal'

	const res: string[] = []
	let current = ''
	let allowEmpty = false

	for (const char of string) {
		if (state === 'backslash') {
			current += char
			state = 'doublequote'
			continue
		}

		if (state === 'doublequote' && char === '\\') {
			state = 'backslash'
			continue
		}

		if (char === '"') {
			if (state === 'normal') {
				state = 'doublequote'
				allowEmpty = true
				continue
			}
			if (state === 'doublequote') {
				state = 'normal'
				continue
			}
		}

		if (char === "'") {
			if (state === 'normal') {
				state = 'singlequote'
				allowEmpty = true
				continue
			}
			if (state === 'singlequote') {
				state = 'normal'
				continue
			}
		}

		if (/\s/.test(char)) {
			if (state === 'normal') {
				if (current !== '' || allowEmpty) {
					res.push(current)
				}
				current = ''
				allowEmpty = false
				continue
			}
		}

		current += char
	}

	if (state !== 'normal') {
		return
	}

	res.push(current)
	return res
}

export function parseCommand(string: string): { commandName: string; args: string[] } | undefined {
	const res = parseShellLikeCommand(string)
	if (res === undefined) {
		return
	}

	if (0 < res.length && /^!([a-zA-Z_-]+)$/.test(res[0])) {
		const [name, ...args] = res
		return { commandName: name.substring(1).toLowerCase(), args: args ?? [] }
	}
}

export function parseCommandArgs(
	argsToParse: string[],
	optionsWithValue: string[] = [],
	minimumArgs = 0
): { args: string[]; options: { [_: string]: string | boolean } } {
	const args = []
	const options: { [_: string]: string | boolean } = {}

	for (let i = 0; i < argsToParse.length; i++) {
		const arg = argsToParse[i]

		if (arg !== '--' && arg.startsWith('--')) {
			let optName = arg.slice(2)
			let optValue: string | boolean = true

			const equalIndex = arg.indexOf('=')
			if (equalIndex !== -1) {
				optName = arg.slice(2, equalIndex)
			}

			if (optName === '') {
				throw `オプション名を指定してください: ${arg}`
			}

			const isWithValue = optionsWithValue.includes(optName)

			if (isWithValue) {
				if (equalIndex !== -1) {
					optValue = arg.slice(equalIndex + 1)
				} else {
					if (i + 1 === argsToParse.length) {
						throw `引数には値が必要です: ${optName}`
					}
					i++
					optValue = argsToParse[i]
				}
			} else {
				if (equalIndex !== -1) {
					throw `引数は値を持てません: ${optName}`
				}
			}

			options[optName] = optValue
			continue
		}

		if (arg !== '-' && arg.startsWith('-')) {
			const opts = arg.slice(1).split('')
			if (opts.length === 1) {
				if (optionsWithValue.includes(opts[0])) {
					if (i + 1 === argsToParse.length) {
						throw `引数には値が必要です: ${opts[0]}`
					}
					i++
					options[opts[0]] = argsToParse[i]
					continue
				}
			}

			for (const opt of opts) {
				if (optionsWithValue.includes(opt)) {
					throw `引数には値が必要です: ${opt}`
				}
				options[opt] = true
			}

			continue
		}

		args.push(arg)
	}

	if (args.length < minimumArgs) {
		throw '引数の数が足りません'
	}

	return { args, options }
}

export function getOption(
	options: { [_: string]: string | boolean },
	keys: string[]
): string | boolean

export function getOption<T>(
	options: { [_: string]: string | boolean },
	keys: string[],
	defaultValue: T
): string | boolean | T

export function getOption<T>(
	options: { [_: string]: string | boolean },
	keys: string[],
	defaultValue?: T
): T | string | boolean {
	for (const key of keys) {
		if (key in options) {
			return options[key]
		}
	}

	if (defaultValue === undefined) {
		return false
	}
	return defaultValue
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve()
		}, ms)
	})
}

export function weightedRandom(weights: number[]): number {
	if (weights.length === 0) {
		throw new TypeError('invalid argument')
	}

	let sum = 0
	const cumulative_sum = [0]

	for (const weight of weights) {
		sum += weight
		cumulative_sum.push(sum)
	}

	const random = Math.floor(Math.random() * sum)
	let ok = cumulative_sum.length - 1
	let ng = 0

	while (ok - ng > 1) {
		const mid = ok + Math.floor((ng - ok) / 2)
		if (random < cumulative_sum[mid]) {
			ok = mid
		} else {
			ng = mid
		}
	}

	return ok - 1
}

export function randomPick<T>(array: T | T[]): T {
	if (!Array.isArray(array)) {
		return array
	}

	const weights = array.map((x) => lodash.get(x, 'weight', 100) as number)
	return array[weightedRandom(weights)]
}

export async function subCommandProxy(
	table: {
		[_: string]: (args: string[], msg: discordjs.Message) => Promise<void>
	},
	[subcommand, ...args]: string[],
	msg: discordjs.Message
): Promise<void> {
	const validSubCommands = Object.keys(table).join(' ')
	if (!subcommand) {
		await msg.channel.send(`サブコマンドを指定して欲しいロボ: ${validSubCommands}`)
		return
	}

	const func = table[subcommand]
	if (func) {
		await func(args, msg)
	} else {
		await msg.channel.send(`知らないサブコマンドロボねえ…: ${validSubCommands}`)
	}
}

export function replaceEmoji(text: string, emojis: discordjs.GuildEmojiManager): string {
	return text.replace(/:(\w+):/g, (match, emojiName) => {
		const foundEmoji = emojis.cache.find((x) => x.name === emojiName)
		return foundEmoji ? foundEmoji.toString() : match
	})
}

export function isValidUrl(url: string): boolean {
	const validUrlRegExp =
		/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/
	return validUrlRegExp.test(url)
}

export function mustValidUrl(url: string): void {
	if (!isValidUrl(url)) {
		throw new Error(`不正なURL: ${url}`)
	}
}

export async function forEachAsyncOf<T>(
	arr: Iterable<T>,
	doWithX: (x: T) => Promise<void>
): Promise<void> {
	const errors: unknown[] = []

	await Promise.all(
		Array.from(arr, (x) => {
			return (async (): Promise<void> => {
				try {
					await doWithX(x)
				} catch (e) {
					errors.push(e)
				}
			})()
		})
	)

	if (errors.length !== 0) {
		throw errors
	}
}

export type LikeTextChannel = discordjs.TextBasedChannel

export type PaginationResult<T> =
	| { kind: 'ok'; maxPage: number; value: T[]; firstIndex: number }
	| { kind: 'invalidPageId'; maxPage: number }
	| { kind: 'empty' }

export function pagination<T>(
	array: readonly T[],
	page: number,
	{ pageLength } = { pageLength: 20 }
): PaginationResult<T> {
	if (array.length === 0) {
		return { kind: 'empty' }
	}

	const maxPage = Math.ceil(array.length / pageLength)

	if (page < 1 || maxPage < page) {
		return { kind: 'invalidPageId', maxPage }
	}

	const firstIndex = pageLength * (page - 1)
	const pagedArray = array.slice(firstIndex, pageLength * page)
	return { kind: 'ok', maxPage, value: pagedArray, firstIndex }
}

export class RetryError extends Error {
	constructor(public cause: unknown) {
		super()
	}
}

export async function retry<T>(
	func: () => Promise<T>,
	ntimes: number,
	{ logging = false, waitMs = 0 } = {}
): Promise<T> {
	let lastError: unknown

	for (let i = 0; i < ntimes; i++) {
		try {
			const a = await func()
			return a
		} catch (e) {
			lastError = e
			if (logging) {
				console.error(e)
			}
		}

		await delay(waitMs)
	}

	throw new RetryError(lastError ?? unreachable())
}

export function parseIndexes(strings: string[], min: number, max: number): number[] {
	let ret: number[] = []

	for (const str of strings) {
		const match = /(\d+)(?:-|\.\.)(\d+)/.exec(str)
		if (match) {
			const start = parseInt(match[1], 10)
			const end = parseInt(match[2], 10)

			if (!(start < end)) {
				throw new Error('invalid expression')
			}

			ret = [...ret, ...lodash.range(start, end + 1)]
			continue
		}

		const index = parseInt(str, 10)
		if (Number.isNaN(index)) {
			throw new Error(`failed to parse ${str} as int`)
		}

		ret.push(index)
	}

	if (!ret.every((v) => min <= v && v <= max)) {
		throw new Error('out of range')
	}

	return ret
}

export async function readAll(rs: stream.Readable): Promise<Buffer> {
	const buffers: Buffer[] = []
	for await (const chunk of rs) {
		buffers.push(chunk as Buffer)
	}

	return Buffer.concat(buffers)
}

export function removePrefix(str: string, prefix: string): string {
	if (str.startsWith(prefix)) {
		return str.slice(prefix.length)
	}

	return str
}

export class ResultOk<T> {
	constructor(readonly value: T) {}
	isOk(): this is ResultOk<T> {
		return true
	}
	isErr(): this is never {
		return false
	}
	okOrThrow(_f: unknown): T {
		return this.value
	}
}

export class ResultErr<T> {
	constructor(readonly value: T) {}
	isOk(): this is never {
		return false
	}
	isErr(): this is ResultErr<T> {
		return true
	}
	okOrThrow(f: Error | ((err: T) => Error)): never {
		if (typeof f === 'function') {
			throw f(this.value)
		}
		throw f
	}
}

export type Result<T, E> = ResultOk<T> | ResultErr<E>

export function tryEither<T>(f: () => T): Result<T, unknown> {
	try {
		return new ResultOk(f())
	} catch (e) {
		return new ResultErr(e)
	}
}
