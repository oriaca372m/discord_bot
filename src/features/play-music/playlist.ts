import type { Music } from 'Src/features/play-music/music'
import lodash from 'lodash'
import * as u from 'Src/utils'
import type { z } from 'zod'
import type {
	SerializedIdGenerator,
	SerializedPlaylist,
	SerializedPlaylistItem,
} from './rpc-interface'
import type { MusicDeserializer } from './music-deserializer'
import { IdReorderableList } from './id-reorderable-list'

export type PlaylistItemId = number

export class PlaylistItem {
	constructor(
		readonly id: PlaylistItemId,
		readonly music: Music
	) {}

	serialize(): z.infer<typeof SerializedPlaylistItem> {
		return { id: this.id, music: this.music.serialize() }
	}
}

class IdGenerator {
	#next: number
	constructor(initialValue = 0) {
		this.#next = initialValue
	}

	gen(): number {
		return this.#next++
	}

	serialize(): z.infer<typeof SerializedIdGenerator> {
		return { next: this.#next }
	}

	static deserialize(data: z.infer<typeof SerializedIdGenerator>): IdGenerator {
		return new IdGenerator(data.next)
	}
}

function cycle<T>(arr: readonly T[], idx: number): T {
	return arr.at(idx % arr.length) ?? u.unreachable()
}

export class Playlist {
	readonly #items = new IdReorderableList<number, PlaylistItem>((x) => x.id)

	// プレイリストを再生する時に最初に流すべき曲
	// 常に存在するIdを参照する
	// itemsが空の時かつその時に限りundefined
	#currentItemId: PlaylistItemId | undefined

	#idGen!: IdGenerator

	constructor(
		items: readonly PlaylistItem[] = [],
		currentItemId?: PlaylistItemId,
		idGen?: IdGenerator
	) {
		if (!this.#isValidItemsAndCurrentId(items, currentItemId)) {
			throw new Error('不正なデータ')
		}

		this.#items.value = items
		this.#currentItemId = currentItemId
		this.#idGen = idGen ?? this.#createIdGen()
	}

	#createIdGen(): IdGenerator {
		return new IdGenerator(Math.max(-1, ...this.#items.value.map((x) => x.id)) + 1)
	}

	get isEmpty(): boolean {
		return this.#items.isEmpty
	}

	get items(): readonly PlaylistItem[] {
		return this.#items.value
	}

	get currentItem(): PlaylistItem | undefined {
		if (this.#currentItemId === undefined) {
			return undefined
		}
		return this.#items.findById(this.#currentItemId)
	}

	get currentItemIndex(): number | undefined {
		if (this.#currentItemId === undefined) {
			return undefined
		}
		return this.#items.findIndexById(this.#currentItemId)
	}

	setCurrentItem(id: PlaylistItemId | undefined): void {
		this.#currentItemId = id
	}

	clear(): void {
		this.#items.clear()
		this.#currentItemId = undefined
		this.#idGen = new IdGenerator()
	}

	#isValidItemsAndCurrentId(
		items: readonly PlaylistItem[],
		currentItemId: PlaylistItemId | undefined
	): boolean {
		if (items.length === 0) {
			return currentItemId === undefined
		}

		return items.some((x) => x.id === currentItemId)
	}

	addMusics(musics: readonly Music[], insertBeforeId?: PlaylistItemId): void {
		const items = musics.map((x) => new PlaylistItem(this.#idGen.gen(), x))
		this.#items.insert(insertBeforeId, ...items)

		if (this.#currentItemId === undefined) {
			this.#currentItemId = this.#items.at(0)?.id
		}
	}

	moveItem(src: PlaylistItemId, destBefore: PlaylistItemId | undefined): void {
		this.#items.move(src, destBefore)
	}

	deleteItem(id: PlaylistItemId): void {
		if (this.#currentItemId === id) {
			const nextId = cycle(
				this.#items.value,
				(this.currentItemIndex ?? u.unreachable()) + 1
			).id
			this.#currentItemId = nextId === id ? undefined : nextId
		}
		this.#items.delete(id)
	}

	#changeCurrentItem(offset: number): void {
		if (this.isEmpty) {
			throw new Error('駄目なタイミング')
		}

		const currentIdx = this.currentItemIndex ?? u.unreachable()
		this.#currentItemId = cycle(this.#items.value, currentIdx + offset).id
	}

	next(): void {
		this.#changeCurrentItem(1)
	}

	prev(): void {
		this.#changeCurrentItem(-1)
	}

	switch(id: PlaylistItemId): void {
		this.#items.mustValidId(id)
		this.#currentItemId = id
	}

	switchIndex(to: number): void {
		if (to < 0 || this.items.length <= to) {
			throw new Error('そんなに曲数が無い')
		}

		this.#currentItemId = (this.items[to] ?? u.unreachable()).id
	}

	shuffle(): void {
		this.#items.value = lodash.shuffle(this.#items.value)
	}

	serialize(): z.infer<typeof SerializedPlaylist> {
		return {
			items: this.items.map((item) => item.serialize()),
			currentItemId: this.#currentItemId,
			idGenerator: this.#idGen.serialize(),
		}
	}

	static deserializeItems(
		deserializer: MusicDeserializer,
		items: z.infer<typeof SerializedPlaylistItem>[]
	): PlaylistItem[] {
		return items.map((item) => {
			const music = deserializer.deserialize(item.music)
			return new PlaylistItem(item.id, music)
		})
	}

	static deserialize(
		deserializer: MusicDeserializer,
		data: z.infer<typeof SerializedPlaylist>
	): Playlist {
		return new Playlist(
			Playlist.deserializeItems(deserializer, data.items),
			data.currentItemId,
			IdGenerator.deserialize(data.idGenerator)
		)
	}
}
