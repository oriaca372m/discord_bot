import { TypedEvent } from 'Src/typed-event'

export interface ReadonlyBindable<T> {
	readonly valueChanged: TypedEvent<T>
	readonly value: T
	getValue(): T

	readonly subscribe: (handler: () => void) => () => void
	readonly getSnapshot: () => T
}

function throwError(error: Error): never {
	throw error
}

export class IdReorderableList<Id, V> implements ReadonlyBindable<readonly V[]> {
	#values: V[] = []
	constructor(
		readonly getId: (value: V) => Id,
		readonly isEqual: (a: Id, b: Id) => boolean = (a, b) => a === b
	) {}

	readonly valueChanged = new TypedEvent<readonly V[]>()
	readonly subscribe = (handler: () => void) => {
		this.valueChanged.on(handler)
		return () => {
			this.valueChanged.off(handler)
		}
	}

	#emit(): void {
		this.valueChanged.emit(this.#values)
	}

	get value(): readonly V[] {
		return this.#values
	}

	getValue(): readonly V[] {
		return this.#values
	}

	readonly getSnapshot = () => Array.from(this.#values)

	set value(values: readonly V[]) {
		this.#values = Array.from(values)
		this.#emit()
	}

	[Symbol.iterator](): Iterator<V> {
		return this.#values[Symbol.iterator]()
	}

	get length(): number {
		return this.#values.length
	}

	get isEmpty(): boolean {
		return this.#values.length === 0
	}

	at(index: number): V | undefined {
		return this.#values.at(index)
	}

	findById(pos: Id): V | undefined {
		return this.#values.find((x) => this.isEqual(pos, this.getId(x)))
	}

	findIndexById(pos: Id): number | undefined {
		const idx = this.#values.findIndex((x) => this.isEqual(pos, this.getId(x)))
		return idx === -1 ? undefined : idx
	}

	#idToIndex(id: Id): number {
		return this.findIndexById(id) ?? throwError(new Error('id not found'))
	}

	insert(pos: Id | undefined, ...values: V[]): void {
		if (pos === undefined) {
			this.#values.push(...values)
			this.#emit()
			return
		}

		this.#values.splice(this.#idToIndex(pos), 0, ...values)
		this.#emit()
	}

	insertIndex(index: number, ...values: V[]): void {
		this.#values.splice(index, 0, ...values)
		this.#emit()
	}

	delete(pos: Id): void {
		this.#values.splice(this.#idToIndex(pos), 1)
		this.#emit()
	}

	deleteIndex(index: number): void {
		if (index < 0 || index >= this.#values.length) {
			throw new RangeError('invalid index')
		}

		this.#values.splice(index, 1)
		this.#emit()
	}

	move(from: Id, to: Id | undefined): void {
		const fromIndex = this.#idToIndex(from)

		if (to === undefined) {
			this.#values.push(...this.#values.splice(fromIndex, 1))
			this.#emit()
			return
		}

		this.moveIndex(fromIndex, this.#idToIndex(to))
	}

	moveIndex(from: number, to: number): void {
		if (from < 0 || from >= this.#values.length) {
			throw new RangeError('invalid from')
		}
		if (to < 0 || to > this.#values.length) {
			throw new RangeError('invalid to')
		}
		if (from === to || from === to + 1) {
			return
		}

		const d = from < to ? -1 : 0
		this.#values.splice(to + d, 0, ...this.#values.splice(from, 1))
		this.#emit()
	}

	clear(): void {
		this.value = []
	}

	mustValidId(id: Id): void {
		if (this.findById(id) === undefined) {
			throw new Error('id not found')
		}
	}
}
