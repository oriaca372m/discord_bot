import { promises as fs } from 'fs'
import TOML from '@iarna/toml'
import lodash from 'lodash'
import * as path from 'path'
import Fuse from 'fuse.js'

import * as utils from 'Src/utils'

import { Music, MusicCollection } from 'Src/features/play-music/music'
import { MusicFile, MusicObject } from 'Src/features/play-music/music-file'

type MusicList = MusicFile[]
type MusicLists = Map<string, MusicList>

export type MusicListFormat = {
	readonly name: string
	readonly musics: MusicObject[]
}

async function loadMusicLists(dir: string): Promise<MusicLists> {
	const musicLists = new Map<string, MusicList>()

	let files: string[]
	try {
		files = await fs.readdir(dir)
	} catch (e) {
		console.error(`couldn't read a playlist directory: ${dir}`)
		return musicLists
	}

	for (const file of files) {
		const toml = await fs.readFile(path.join(dir, file), 'utf-8')
		// TODO: バリデーション
		const parsed = (await TOML.parse.async(toml)) as unknown as MusicListFormat
		const musicListName = parsed.name
		musicLists.set(
			musicListName,
			parsed.musics.map((x) => new MusicFile({ ...x, memberMusicList: musicListName }))
		)
	}

	return musicLists
}

function getAllMusics(musicLists: MusicLists): MusicFile[] {
	return lodash.flatten(Array.from(musicLists.values()))
}

function createMap<K, V>(array: V[], keyFunc: (val: V) => K | undefined): Map<K, V[]> {
	const res = new Map<K, V[]>()
	for (const i of array) {
		const key = keyFunc(i)
		if (key === undefined) {
			continue
		}

		if (!res.has(key)) {
			res.set(key, [])
		}
		;(res.get(key) ?? utils.unreachable()).push(i)
	}
	return res
}

export class MusicDatabase {
	#allMusics!: MusicFile[]
	#allMusicsFuse!: Fuse<MusicFile>

	#musicLists = new Map<string, MusicFile[]>()
	#artists = new Map<string, MusicFile[]>()
	#albums = new Map<string, MusicFile[]>()

	constructor(readonly musicListsDir: string) {}

	get allMusics(): MusicFile[] {
		return this.#allMusics
	}

	async init(): Promise<void> {
		this.#musicLists = await loadMusicLists(this.musicListsDir)
		this.#allMusics = getAllMusics(this.#musicLists)
		this.#artists = createMap(this.allMusics, (v) => v.metadata.artist)
		this.#albums = createMap(this.allMusics, (v) => v.metadata.album)

		this.#allMusicsFuse = new Fuse(this.allMusics, {
			keys: [
				{ name: 'metadata.title', weight: 0.6 },
				{ name: 'metadata.album', weight: 0.3 },
				{ name: 'metadata.artist', weight: 0.1 },
			],
		})
	}

	getByUuid(uuid: string): Music | undefined {
		return this.allMusics.find((x) => x.uuid === uuid)
	}

	search(keyword: string): Music[] {
		return this.#allMusicsFuse.search(keyword).map((x) => x.item)
	}

	#searchName(names: Map<string, MusicFile[]>, keyword: string): MusicCollection[] {
		const fuse = new Fuse(
			Array.from(names.keys(), (name) => ({ name })),
			{ keys: ['name'] }
		)

		return fuse
			.search(keyword)
			.map(
				(x) =>
					new MusicCollection(x.item.name, names.get(x.item.name) ?? utils.unreachable())
			)
	}

	searchArtistName(keyword: string): MusicCollection[] {
		return this.#searchName(this.#artists, keyword)
	}

	searchAlbumName(keyword: string): MusicCollection[] {
		return this.#searchName(this.#albums, keyword)
	}
}
