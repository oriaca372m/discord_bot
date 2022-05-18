import { promises as fs } from 'fs'
import * as path from 'path'
import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'
import * as u from 'Src/utils'
import * as l from 'lodash'
import stream from 'stream'

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

export class S3ObjectStorage implements ObjectStorage {
	#bucket: string
	#rootPath: string
	#client: S3Client

	private constructor(bucket: string, rootPath: string, client: S3Client) {
		this.#bucket = bucket
		this.#rootPath = rootPath
		this.#client = client
	}

	static create(
		endpointUrl: string,
		accessKeyId: string,
		secretAccessKey: string,
		bucket: string,
		rootPath: string
	): S3ObjectStorage {
		return new S3ObjectStorage(
			bucket,
			rootPath,
			new S3Client({
				region: 'us-east-1',
				endpoint: endpointUrl,
				credentials: {
					accessKeyId,
					secretAccessKey,
				},
			})
		)
	}

	async readFile(path: string): Promise<Buffer> {
		const data = await this.#client.send(
			new GetObjectCommand({
				Bucket: this.#bucket,
				Key: this.#getPath(path),
			})
		)

		if (data.Body === undefined) {
			throw new Error('failed to read a file')
		}
		return await u.readAll(data.Body as stream.Readable)
	}

	async writeFile(path: string, content: string | Buffer): Promise<void> {
		await this.#client.send(
			new PutObjectCommand({
				Bucket: this.#bucket,
				Key: this.#getPath(path),
				Body: content,
			})
		)
	}

	async unlink(path: string): Promise<void> {
		await this.#client.send(
			new DeleteObjectCommand({ Bucket: this.#bucket, Key: this.#getPath(path) })
		)
	}

	async readDir(inPath?: string): Promise<string[]> {
		inPath = this.#getPath(inPath)
		const prefix = inPath === '' ? '' : path.join(inPath, '/')
		const data = await this.#client.send(
			new ListObjectsCommand({
				Bucket: this.#bucket,
				Delimiter: '/',
				Prefix: prefix,
			})
		)

		if (data.Contents === undefined) {
			return []
		}
		return l.compact(data.Contents.map((x) => x.Key)).map((x) => u.removePrefix(x, prefix))
	}

	mkdir(_path: string): Promise<void> {
		return Promise.resolve()
	}

	cd(path: string): Promise<ObjectStorage> {
		return Promise.resolve(new S3ObjectStorage(this.#bucket, this.#getPath(path), this.#client))
	}

	#getPath(path?: string) {
		if (path === undefined) {
			return this.#rootPath
		}

		return joinPathSafe(this.#rootPath, path).replace(/^\//, '')
	}
}
