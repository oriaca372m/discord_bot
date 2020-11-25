import * as discordjs from 'discord.js'
import { Action, ActionResult } from 'Src/features/custom-reply/actions/action'
import { Response } from 'Src/features/custom-reply/config'
import { createCanvas, loadImage } from 'canvas'

async function genImage(str: string): Promise<Buffer> {
	const img = await loadImage('./assets/jakurai-clock.png')
	const canvas = createCanvas(img.width, img.height)
	const ctx = canvas.getContext('2d')

	// 画像を転送
	ctx.drawImage(img, 0, 0)

	// 時間を描画
	ctx.font = '70px sans-serif'
	ctx.textAlign = 'center'
	ctx.fillStyle = 'white'
	ctx.fillText(str, 960, 927)

	return canvas.toBuffer('image/jpeg')
}

export class ActionJakuraiClock implements Action {
	async handle(_msg: discordjs.Message, res: Response): Promise<ActionResult | undefined> {
		const now = new Date()
		const buf = await genImage(`${now.getHours()}時${now.getMinutes()}分`)
		return { text: res.text, options: { files: [buf] } }
	}
}
