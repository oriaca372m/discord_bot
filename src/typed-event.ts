export interface Listener<T> {
	(event: T): unknown
}

export class TypedEvent<T> {
	readonly #listeners = new Set<Listener<T> | Listener<T | void>>()
	readonly #listenersOncer = new Set<Listener<T>>()

	on(listener: Listener<T>): void
	on(listener: Listener<T>, runOnceImmediately: false): void
	on(listener: Listener<T | void>, runOnceImmediately: true): void
	on(listener: Listener<T> | Listener<T | void>, runOnceImmediately = false): void {
		this.#listeners.add(listener)

		if (runOnceImmediately) {
			;(listener as Listener<T | void>)(undefined)
		}
	}

	once(listener: Listener<T>): void {
		this.#listenersOncer.add(listener)
	}

	off(listener: Listener<T> | Listener<T | void>): void {
		this.#listeners.delete(listener)
	}

	emit(event: T): void {
		this.#listeners.forEach((listener) => listener(event))

		this.#listenersOncer.forEach((listener) => listener(event))
		this.#listenersOncer.clear()
	}
}
