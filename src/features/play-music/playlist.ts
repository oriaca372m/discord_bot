import { Music } from 'Src/features/play-music/music'
import lodash from 'lodash'

export class Playlist {
	private _musics: Music[] = []
	private playingTrack: number | undefined

	get isEmpty(): boolean {
		return this.playingTrack === undefined
	}

	get currentMusic(): Music | undefined {
		if (this.playingTrack === undefined) {
			return
		}

		return this.musics[this.playingTrack]
	}

	get musics(): readonly Music[] {
		return this._musics
	}

	addMusic(music: Music): void {
		this._musics.push(music)

		if (this.playingTrack === undefined) {
			this.playingTrack = 0
		}
	}

	clear(): void {
		this._musics = []
		this.playingTrack = undefined
	}

	next(): void {
		if (this.playingTrack === undefined) {
			throw '駄目なタイミング'
		}

		this.playingTrack += 1
		if (this.musics.length <= this.playingTrack) {
			this.playingTrack = 0
		}
	}

	prev(): void {
		if (this.playingTrack === undefined) {
			throw '駄目なタイミング'
		}

		this.playingTrack -= 1
		if (this.playingTrack < 0) {
			this.playingTrack = this.musics.length - 1
		}
	}

	switch(to: number): void {
		if (this.playingTrack === undefined) {
			throw '駄目なタイミング'
		}

		if (to < 0 || this.musics.length <= to) {
			throw 'そんなに曲数が無い'
		}

		this.playingTrack = to
	}

	shuffle(): void {
		if (this.playingTrack === undefined) {
			throw '駄目なタイミング'
		}

		this._musics = lodash.shuffle(this.musics)
		this.playingTrack = 0
	}
}
