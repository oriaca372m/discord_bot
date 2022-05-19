import * as utils from 'Src/utils'
import * as discordjs from 'discord.js'
import { Action, ActionResult } from 'Src/features/custom-reply/actions/action'
import { Response } from 'Src/features/custom-reply/config'
import canvas from 'canvas'
const { createCanvas, loadImage } = canvas

async function genImageJakurai(str: string): Promise<Buffer> {
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

async function genImageItsumi(str: string): Promise<Buffer> {
	const img = await loadImage('./assets/itsumi-clock.jpg')
	const canvas = createCanvas(img.width, img.height)
	const ctx = canvas.getContext('2d')

	// 画像を転送
	ctx.drawImage(img, 0, 0)

	// 時間を描画
	ctx.font = '360px sans-serif'
	ctx.textAlign = 'center'
	ctx.fillStyle = 'black'
	ctx.fillText(str, 1488, 950)

	return canvas.toBuffer('image/jpeg')
}

const generators = [genImageJakurai, genImageItsumi]

export class ActionJakuraiClock implements Action {
	async handle(_msg: discordjs.Message, res: Response): Promise<ActionResult | undefined> {
		const now = new Date()
		const timestr = `${now.getHours()}時${now.getMinutes()}分`
		const buf = await utils.randomPick(generators)(timestr)
		return { text: res.text, options: { files: [buf] } }
	}
}
