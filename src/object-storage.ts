import { promises as fs } from 'fs'
import * as path from 'path'

export interface ObjectStorage {
	readFile(path: string): Promise<Buffer>
	writeFile(path: string, content: Buffer | string): Promise<void>
	unlink(path: string): Promise<void>
	readDir(path?: string): Promise<string[]>
	mkdir(path: string): Promise<void>

	cd(path: string): Promise<ObjectStorage>
}

// https://www.stackhawk.com/blog/node-js-path-traversal-guide-examples-and-prevention/
function joinPathSafe(base: string, user_input: string) {
	if (user_input.indexOf('\0') !== -1) {
		throw new Error('invalid string')
	}
	const safe_input = path.normalize(user_input).replace(/^(\.\.(\/|\\|$))+/, '')
	const path_string = path.join(base, safe_input)
	return path_string
}

export class FileSystemObjectStorage implements ObjectStorage {
	#rootPath: string

	constructor(rootPath: string) {
		this.#rootPath = rootPath
	}

	readFile(path: string): Promise<Buffer> {
		return fs.readFile(this.#getPath(path))
	}

	writeFile(path: string, content: Buffer | string): Promise<void> {
		return fs.writeFile(this.#getPath(path), content)
	}

	unlink(path: string): Promise<void> {
		return fs.unlink(this.#getPath(path))
	}

	readDir(path?: string): Promise<string[]> {
		return fs.readdir(this.#getPath(path))
	}

	async mkdir(path: string): Promise<void> {
		await fs.mkdir(this.#getPath(path), { recursive: true })
	}

	cd(path: string): Promise<ObjectStorage> {
		return Promise.resolve(new FileSystemObjectStorage(this.#getPath(path)))
	}

	#getPath(path?: string) {
		if (path === undefined) {
			return this.#rootPath
		}

		return joinPathSafe(this.#rootPath, path)
	}
}
