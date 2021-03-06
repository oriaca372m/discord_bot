import { isLeft } from 'fp-ts/Either'
import * as t from 'io-ts'
import { PathReporter } from 'io-ts/lib/PathReporter'

import { FeatureInterface } from 'Src/features/feature'

import { FeatureMondai } from 'Src/features/mondai'
import { FeatureSimpleReply } from 'Src/features/simple-reply'
import { FeatureCustomReply } from 'Src/features/custom-reply'
import FeatureCommandAlias from 'Src/features/command-alias'
import { FeaturePlayMusic } from 'Src/features/play-music'
import { FeatureSk } from 'Src/features/sk'
import { FeatureWebApi } from 'Src/features/webapi'
import { FeatureBasicWebApiMethods } from 'Src/features/basic-webapi-methods'

export const FeatureConfigBase = t.intersection([
	t.type({ feature: t.string }),
	t.partial({ id: t.string }),
])
export type FeatureConfigBaseType = t.TypeOf<typeof FeatureConfigBase>

type Loader = (entry: FeatureConfigBaseType) => FeatureInterface

function makeLoader<T extends t.Mixed>(
	ConfigType: T,
	converter: (entry: t.TypeOf<T>) => FeatureInterface
): Loader {
	return (entry: FeatureConfigBaseType) => {
		const result = ConfigType.decode(entry)
		if (isLeft(result)) {
			throw PathReporter.report(result)
		}
		return converter(result.right)
	}
}

const loaders: { [key: string]: Loader } = {
	simple_reply: () => new FeatureSimpleReply(),

	mondai: makeLoader(
		t.type({
			command_name: t.string,
			config_path: t.string,
		}),
		(cfg) => new FeatureMondai(cfg.command_name, cfg.config_path)
	),

	custom_reply: makeLoader(
		t.type({
			command_name: t.string,
		}),
		(cfg) => new FeatureCustomReply(cfg.command_name)
	),

	command_alias: makeLoader(
		t.type({
			command_name: t.string,
			to_name: t.string,
			to_args: t.array(t.string),
		}),
		(cfg) => new FeatureCommandAlias(cfg.command_name, cfg.to_name, cfg.to_args)
	),

	play_music: makeLoader(
		t.type({
			command_name: t.string,
		}),
		(cfg) => new FeaturePlayMusic(cfg.command_name)
	),

	sk: makeLoader(
		t.type({
			sk_command_name: t.string,
			set_command_name: t.string,
		}),
		(cfg) => new FeatureSk(cfg.sk_command_name, cfg.set_command_name)
	),

	web_api: makeLoader(
		t.type({
			port: t.number,
		}),
		(cfg) => new FeatureWebApi(cfg.port)
	),

	basic_web_api_methods: makeLoader(
		t.type({
			webui_command_name: t.string,
			webui_url: t.string,
		}),
		(cfg) => new FeatureBasicWebApiMethods(cfg.webui_command_name, cfg.webui_url)
	),
}

export class FeatureLoader {
	private readonly _features = new Map<string, FeatureInterface>()
	private _unnamedCounter = 0

	addEntry(entry: FeatureConfigBaseType): boolean {
		const loader = loaders[entry.feature]
		if (loader === undefined) {
			console.error(`undefined feature: ${entry.feature}`)
			return false
		}

		try {
			const feature = loader(entry)

			if (entry.id === undefined) {
				if (entry.feature === 'web_api') {
					entry.id = 'webapi'
				} else {
					entry.id = `__unnamed_${this._unnamedCounter}`
					++this._unnamedCounter
				}
			}

			this._features.set(entry.id, feature)
			return true
		} catch (e) {
			console.error(`an error occurred while loading the feature '${entry.feature}':`)
			console.error(e)
			return false
		}
	}

	toFeatures(): Map<string, FeatureInterface> {
		return this._features
	}
}
