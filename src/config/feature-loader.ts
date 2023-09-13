import { z } from 'zod'

import { FeatureInterface } from 'Src/features/feature'

import { FeatureMondai } from 'Src/features/mondai'
import { FeatureSimpleReply } from 'Src/features/simple-reply'
import { FeatureCustomReply } from 'Src/features/custom-reply'
import FeatureCommandAlias from 'Src/features/command-alias'
import { FeaturePlayMusic } from 'Src/features/play-music'
import { FeatureSk } from 'Src/features/sk'
import { FeatureWebApi } from 'Src/features/webapi'
import { FeatureBasicWebApiMethods } from 'Src/features/basic-webapi-methods'

export const FeatureConfigBase = z
	.object({
		feature: z.string(),
		id: z.string().optional(),
	})
	.passthrough()
export type FeatureConfigBaseType = z.infer<typeof FeatureConfigBase>

type Loader = (entry: FeatureConfigBaseType) => FeatureInterface

function makeLoader<O>(
	ConfigType: z.ZodType<O>,
	converter: (entry: O) => FeatureInterface
): Loader {
	return (entry: FeatureConfigBaseType) => converter(ConfigType.parse(entry))
}

const loaders: { [key: string]: Loader } = {
	simple_reply: () => new FeatureSimpleReply(),

	mondai: makeLoader(
		z.object({
			command_name: z.string(),
			config_path: z.string(),
		}),
		(cfg) => new FeatureMondai(cfg.command_name, cfg.config_path)
	),

	custom_reply: makeLoader(
		z.object({
			command_name: z.string(),
		}),
		(cfg) => new FeatureCustomReply(cfg.command_name)
	),

	command_alias: makeLoader(
		z.object({
			command_name: z.string(),
			to_name: z.string(),
			to_args: z.array(z.string()),
		}),
		(cfg) => new FeatureCommandAlias(cfg.command_name, cfg.to_name, cfg.to_args)
	),

	play_music: makeLoader(
		z.object({
			command_name: z.string(),
			youtube_api_key: z.string().optional(),
		}),
		(cfg) => new FeaturePlayMusic(cfg.command_name, cfg.youtube_api_key)
	),

	sk: makeLoader(
		z.object({
			sk_command_name: z.string(),
			set_command_name: z.string(),
		}),
		(cfg) => new FeatureSk(cfg.sk_command_name, cfg.set_command_name)
	),

	web_api: makeLoader(
		z.object({
			port: z.number().int(),
		}),
		(cfg) => new FeatureWebApi(cfg.port)
	),

	basic_web_api_methods: makeLoader(
		z.object({
			webui_command_name: z.string(),
			webui_url: z.string(),
			api_url: z.string().optional(),
		}),
		(cfg) => new FeatureBasicWebApiMethods(cfg.webui_command_name, cfg.webui_url, cfg.api_url)
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
			console.error(`An error occurred while loading the feature '${entry.feature}':`)
			if (e instanceof z.ZodError) {
				console.error(e.toString())
			} else {
				console.error(e)
			}
			return false
		}
	}

	toFeatures(): Map<string, FeatureInterface> {
		return this._features
	}
}
