import type { z } from 'zod'
import type { Music, MusicPlayResource } from './music'
import { Playlist, PlaylistItem } from './playlist'
import type { SerializedMusic } from './rpc-interface'

class DummyMusic implements Music {
	constructor(readonly title: string) {}

	getTitle(): string {
		return this.title
	}

	serialize(): z.infer<typeof SerializedMusic> {
		throw new Error('Method not implemented.')
	}

	createResource(): MusicPlayResource {
		throw new Error('Method not implemented.')
	}

	toListString(): string {
		throw new Error('Method not implemented.')
	}
}

function isUnique<T>(arr: readonly T[]): boolean {
	return arr.length === new Set(arr).size
}

describe('Playlist', () => {
	let playlist: Playlist

	beforeEach(() => {
		playlist = new Playlist()
	})

	describe('3アイテム', () => {
		const musics = [new DummyMusic('hoge'), new DummyMusic('fuga'), new DummyMusic('piyo')]
		let items: PlaylistItem[]
		beforeEach(() => {
			playlist.addMusics(musics)
			items = Array.from(playlist.items)
		})

		test('アイテムのIDに重複が無いこと', () => {
			expect(isUnique(items.map((x) => x.id))).toBeTruthy()
		})

		test('addMusic後にcurrentItemが最初のアイテムになること', () => {
			expect(playlist.currentItem).toEqual(items[0])
		})

		test('switchでcurrentItemが変化すること', () => {
			playlist.switch(1)
			expect(playlist.currentItem).toEqual(items[1])
		})

		test('nextでcurrentItemが次のアイテムになること', () => {
			playlist.next()
			expect(playlist.currentItem).toEqual(items[1])
		})

		test('nextでcurrentItemが循環して最初のアイテムになること', () => {
			playlist.switch(2)
			playlist.next()
			expect(playlist.currentItem).toEqual(items[0])
		})

		test('prevでcurrentItemが前のアイテムになること', () => {
			playlist.switch(1)
			playlist.prev()
			expect(playlist.currentItem).toEqual(items[0])
		})

		test('prevでcurrentItemが循環して最後のアイテムになること', () => {
			playlist.prev()
			expect(playlist.currentItem).toEqual(items[2])
		})

		test('moveのdestBeforeにIDを指定した場合にsrcがdestBeforeの直前に移動すること', () => {
			playlist.moveItem(2, 0)
			expect(playlist.items).toEqual([items[2], items[0], items[1]])
		})

		test('moveのdestBeforeにundefinedを指定した場合srcが最後に移動すること', () => {
			playlist.moveItem(0, undefined)
			expect(playlist.items).toEqual([items[1], items[2], items[0]])
		})

		test('deleteItemでアイテムが削除されること', () => {
			playlist.deleteItem(1)
			expect(playlist.items).toEqual([items[0], items[2]])
		})

		test('deleteItem後も削除されたアイテムIDが再使用されないこと', () => {
			const ids = playlist.items.map((x) => x.id)
			playlist.deleteItem(1)
			playlist.addMusics([new DummyMusic('new')])
			ids.push(playlist.items[2]!.id)
			expect(isUnique(ids)).toBeTruthy()
		})
	})

	test('初期状態でcurrentItemがundefinedであること', () => {
		expect(playlist.currentItem).toBeUndefined()
	})

	test('clear後にIDが0からの連番になること', () => {
		playlist.addMusics([new DummyMusic('hoge')])
		playlist.clear()
		const music = new DummyMusic('fuga')
		playlist.addMusics([music])
		expect(playlist.items).toEqual([new PlaylistItem(0, music)])
	})
})
