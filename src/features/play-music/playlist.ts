import lodash from 'lodash'

import { Music } from 'Src/features/play-music/music'
import * as utils from 'Src/utils'

export class Playlist {
	#musics: Music[] = []
	#playingTrack: number | undefined

	get isEmpty(): boolean {
		return this.#playingTrack === undefined
	}

	get currentMusic(): Music | undefined {
		if (this.#playingTrack === undefined) {
			return
		}

		return this.musics[this.#playingTrack]
	}

	get currentTrack(): number | undefined {
		return this.#playingTrack
	}

	get musics(): readonly Music[] {
		return this.#musics
	}

	addMusic(music: Music, insertBeforeIndex?: number): void {
		if (insertBeforeIndex !== undefined) {
			this.#musics.splice(insertBeforeIndex, 0, music)

			if (this.#playingTrack !== undefined && insertBeforeIndex <= this.#playingTrack) {
				this.#playingTrack += 1
			}
		} else {
			this.#musics.push(music)
		}

		if (this.#playingTrack === undefined) {
			this.#playingTrack = 0
		}
	}

	clear(): void {
		this.#musics = []
		this.#playingTrack = undefined
	}

	next(): void {
		utils.expects(this.#playingTrack !== undefined)

		this.#playingTrack += 1
		if (this.musics.length <= this.#playingTrack) {
			this.#playingTrack = 0
		}
	}

	prev(): void {
		utils.expects(this.#playingTrack !== undefined)

		this.#playingTrack -= 1
		if (this.#playingTrack < 0) {
			this.#playingTrack = this.musics.length - 1
		}
	}

	switch(to: number): void {
		utils.expects(!this.isEmpty)
		utils.expects(Number.isInteger(to) && 0 <= to && to < this.musics.length)

		this.#playingTrack = to
	}

	shuffle(): void {
		utils.expects(!this.isEmpty)

		this.#musics = lodash.shuffle(this.musics)
		this.#playingTrack = 0
	}
}
