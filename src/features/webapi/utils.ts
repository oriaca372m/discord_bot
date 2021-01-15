import crypto from 'crypto'

export function bufferToHex(buffer: Uint8Array): string {
	return [...buffer].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function hexToBuffer(str: string): Uint8Array {
	const splited = str.match(/.{2}/g)
	if (splited === null) {
		throw 'not hex string!'
	}
	return new Uint8Array(splited.map((x) => parseInt(x, 16)))
}

// 戻り値は [iv, encrypted]
export function encrypt(content: Uint8Array, key: Uint8Array): [Uint8Array, Uint8Array] {
	const iv = new Uint8Array(16)
	crypto.randomFillSync(iv)

	const cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
	const encrypted = cipher.update(content)
	const final = cipher.final()

	return [iv, new Uint8Array(Buffer.concat([encrypted, final]))]
}

export function decrypt(encrypted: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
	const cipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
	const content = cipher.update(encrypted)
	const final = cipher.final()

	return new Uint8Array(Buffer.concat([content, final]))
}
