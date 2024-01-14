import { createCanvas, loadImage, Image, CanvasRenderingContext2D } from 'canvas'

export function calcDivisionNumber(total: number): { x: number; y: number } {
	if (total < 1) {
		throw new Error('だめ')
	}
	let x = 1
	let y = 1

	for (;;) {
		if (total <= x * y) {
			return { x, y }
		}
		x++

		if (total <= x * y) {
			return { x, y }
		}
		y++
	}
}

function drawKeepAspectRatio(
	ctx: CanvasRenderingContext2D,
	image: Image,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const scale = Math.min(w / image.width, h / image.height)
	const sw = scale * image.width
	const sh = scale * image.height
	ctx.drawImage(
		image,
		0,
		0,
		image.width,
		image.height,
		x + (w - sw) / 2,
		y + (h - sh) / 2,
		sw,
		sh
	)
}

export async function generateImageMap(
	width: number,
	height: number,
	files: string[]
): Promise<Buffer> {
	const { x, y } = calcDivisionNumber(files.length)

	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext('2d')

	ctx.fillStyle = 'white'
	ctx.fillRect(0, 0, width, height)

	const singleX = width / x
	const singleY = height / y

	let nowX = 0
	let nowY = 0

	for (let i = 0; i < files.length; i++) {
		const image = await loadImage(files[i])
		drawKeepAspectRatio(ctx, image, nowX * singleX, nowY * singleY, singleX, singleY)

		nowX++
		if (nowX === x) {
			nowX = 0
			nowY++
		}
	}

	return canvas.toBuffer('image/jpeg')
}
