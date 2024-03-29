import { z } from 'zod'
import TOML from '@iarna/toml'

import { FeatureInterface } from 'Src/features/feature'
import { FeatureConfigBase, FeatureLoader } from 'Src/config/feature-loader'

const Config = z.object({
	discord_bot_token: z.string(),
	features: z.array(FeatureConfigBase),
})

export class ConfigLoader {
	token!: string
	features!: Map<string, FeatureInterface>

	constructor(private readonly _toml: string) {}

	async load(): Promise<boolean> {
		const parsed = await TOML.parse.async(this._toml)

		const result = Config.safeParse(parsed)
		if (!result.success) {
			console.error('Failed to parse config file.')
			console.error(result.error.toString())
			return false
		}

		this.token = result.data.discord_bot_token

		let allOk = true
		const featureLoader = new FeatureLoader()
		for (const entry of result.data.features) {
			// addEntryはエラーをなるべく多く表示するために、一度失敗しても続行する
			// allOkが右に無いと一度失敗したあとにaddEntryが評価されなくなる(短絡評価)
			allOk = featureLoader.addEntry(entry) && allOk
		}

		if (allOk) {
			this.features = featureLoader.toFeatures()
		}
		return allOk
	}
}
