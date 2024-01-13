export interface Listener<T> {
	(event: T): unknown
}

export class TypedEvent<T> {
	readonly #listeners = new Set<Listener<T>>()
	readonly #listenersOncer = new Set<Listener<T>>()

	on(listener: Listener<T>): void
	on(listener: Listener<T>, runOnceImmediately: false): void
	on(listener: Listener<T | undefined>, runOnceImmediately: true): void
	on(listener: Listener<T> | Listener<T | undefined>, runOnceImmediately = false): void {
		this.#listeners.add(listener)

		if (runOnceImmediately) {
			;(listener as Listener<T | undefined>)(undefined)
		}
	}

	once(listener: Listener<T>): void {
		this.#listenersOncer.add(listener)
	}

	off(listener: Listener<T>): void {
		this.#listeners.delete(listener)
	}

	emit(event: T): void {
		for (const listener of this.#listeners) {
			listener(event)
		}

		for (const listener of this.#listenersOncer) {
			listener(event)
		}
		this.#listenersOncer.clear()
	}
}
