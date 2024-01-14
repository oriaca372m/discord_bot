import { Music } from 'Src/features/play-music/music'
import lodash from 'lodash'

export class Playlist {
	#musics: Music[] = []
	#playingTrack: number | undefined

	get isEmpty(): boolean {
		return this.#playingTrack === undefined
	}

	get currentMusic(): Music | undefined {
		if (this.#playingTrack === undefined) {
			return undefined
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
		if (this.#playingTrack === undefined) {
			throw new Error('駄目なタイミング')
		}

		this.#playingTrack += 1
		if (this.musics.length <= this.#playingTrack) {
			this.#playingTrack = 0
		}
	}

	prev(): void {
		if (this.#playingTrack === undefined) {
			throw new Error('駄目なタイミング')
		}

		this.#playingTrack -= 1
		if (this.#playingTrack < 0) {
			this.#playingTrack = this.musics.length - 1
		}
	}

	switch(to: number): void {
		if (this.#playingTrack === undefined) {
			throw new Error('駄目なタイミング')
		}

		if (to < 0 || this.musics.length <= to) {
			throw new Error('そんなに曲数が無い')
		}

		this.#playingTrack = to
	}

	shuffle(): void {
		if (this.#playingTrack === undefined) {
			throw new Error('駄目なタイミング')
		}

		this.#musics = lodash.shuffle(this.musics)
		this.#playingTrack = 0
	}
}
