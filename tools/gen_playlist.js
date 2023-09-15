import TOML from '@iarna/toml'
import fs from 'fs'
import path from 'path'
import * as mm from 'music-metadata'
import { v4 as uuidv4 } from 'uuid'

function getTitle(filepath) {
	const filename = path.basename(filepath, path.extname(filepath))

	const match = /^\d+\.\s*(.+)$/.exec(filename)
	if (match) {
		return match[1]
	}

	return filename
}

function usage() {
	console.error('usage: node gen_playlist.js <playlist path> <playlist name>')
	process.exit(1)
}

function emptyObjectToUndefined(obj) {
	return Object.values(obj).some((x) => x !== null && x !== undefined) ? obj : undefined
}

async function main() {
	const stdinBuffer = fs.readFileSync(0, 'utf-8')

	const playlistPath = process.argv[2]
	if (playlistPath === undefined) {
		usage()
	}

	const playlistName = process.argv[3]
	if (playlistName === undefined) {
		usage()
	}

	let cache = new Map()
	try {
		const str = fs.readFileSync(playlistPath, 'utf-8')
		const toml = TOML.parse(str)

		if (toml.name !== playlistName) {
			console.error("the provided playlist name does not match to input file's one.")
			process.exit(1)
		}

		for (const music of toml.musics) {
			cache.set(music.path, music)
		}
	} catch (e) {
		console.log('failed to parse the input file')
	}

	for (const line of stdinBuffer.split('\n')) {
		if (line === '') {
			break
		}

		const cachedMusic = cache.get(line)
		if (cachedMusic !== undefined) {
			cachedMusic.used = true
			continue
		}

		const metadata = {
			title: getTitle(line),
		}

		const music = {
			uuid: uuidv4(),
			path: line,
			used: true,
			metadata,
		}

		console.log(`parsing metadata...: ${line}`)
		try {
			const { common } = await mm.parseFile(line, { skipCovers: true })

			if (common.title) {
				metadata.title = common.title
			}

			metadata.album = common.album
			metadata.artist = common.artist
			metadata.track = emptyObjectToUndefined(common.track)
			metadata.disk = emptyObjectToUndefined(common.disk)
		} catch (e) {
			console.error(`failed to parse metadata: ${line}`)
			continue
		}

		cache.set(line, music)
	}

	const musics = []
	for (const [, music] of cache) {
		if (music.used) {
			delete music.used
			musics.push(music)
		}
	}

	fs.writeFileSync(playlistPath, TOML.stringify({ name: playlistName, musics }))
}

main()
