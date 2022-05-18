import TOML from '@iarna/toml'

import { isRight } from 'fp-ts/Either'
import * as t from 'io-ts'
import { PathReporter } from 'io-ts/lib/PathReporter'

import { FeatureInterface } from 'Src/features/feature'
import { FeatureConfigBase, FeatureLoader } from 'Src/config/feature-loader'

const Config = t.type({
	discord_bot_token: t.string,
	features: t.array(FeatureConfigBase),
})

export class ConfigLoader {
	token!: string
	features!: Map<string, FeatureInterface>

	constructor(private readonly _toml: string) {}

	async load(): Promise<boolean> {
		const parsed = await TOML.parse.async(this._toml)

		const result = Config.decode(parsed)
		if (isRight(result)) {
			this.token = result.right.discord_bot_token

			let allOk = true
			const featureLoader = new FeatureLoader()
			for (const entry of result.right.features) {
				allOk = featureLoader.addEntry(entry) && allOk
			}

			if (allOk) {
				this.features = featureLoader.toFeatures()
			}
			return allOk
		} else {
			console.error(PathReporter.report(result))
			return false
		}
	}
}
