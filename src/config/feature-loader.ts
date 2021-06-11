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

export const FeatureConfigBase = t.type({ id: t.string, feature: t.string })
export type FeatureConfigBaseType = t.TypeOf<typeof FeatureConfigBase>

function loadFeatureSimpleReply(_entry: FeatureConfigBaseType): FeatureSimpleReply {
	return new FeatureSimpleReply()
}

function loadFeatureMondai(entry: FeatureConfigBaseType): FeatureMondai {
	const Config = t.type({
		command_name: t.string,
		config_path: t.string,
	})
	const result = Config.decode(entry)
	if (isLeft(result)) {
		throw PathReporter.report(result)
	}

	const cfg = result.right
	return new FeatureMondai(cfg.command_name, cfg.config_path)
}

function loadFeatureCustomReply(entry: FeatureConfigBaseType): FeatureCustomReply {
	const Config = t.type({
		command_name: t.string,
	})
	const result = Config.decode(entry)
	if (isLeft(result)) {
		throw PathReporter.report(result)
	}

	const cfg = result.right
	return new FeatureCustomReply(cfg.command_name)
}

function loadFeatureCommandAlias(entry: FeatureConfigBaseType): FeatureCommandAlias {
	const Config = t.type({
		command_name: t.string,
		to_name: t.string,
		to_args: t.array(t.string),
	})
	const result = Config.decode(entry)
	if (isLeft(result)) {
		throw PathReporter.report(result)
	}

	const cfg = result.right
	return new FeatureCommandAlias(cfg.command_name, cfg.to_name, cfg.to_args)
}

function loadFeaturePlayMusic(entry: FeatureConfigBaseType): FeaturePlayMusic {
	const Config = t.type({
		command_name: t.string,
	})
	const result = Config.decode(entry)
	if (isLeft(result)) {
		throw PathReporter.report(result)
	}

	const cfg = result.right
	return new FeaturePlayMusic(cfg.command_name)
}

function loadFeatureSk(entry: FeatureConfigBaseType): FeatureSk {
	const Config = t.type({
		sk_command_name: t.string,
		set_command_name: t.string,
	})
	const result = Config.decode(entry)
	if (isLeft(result)) {
		throw PathReporter.report(result)
	}

	const cfg = result.right
	return new FeatureSk(cfg.sk_command_name, cfg.set_command_name)
}

function loadFeatureWebApi(entry: FeatureConfigBaseType): FeatureWebApi {
	const Config = t.type({
		port: t.number,
	})
	const result = Config.decode(entry)
	if (isLeft(result)) {
		throw PathReporter.report(result)
	}

	const cfg = result.right
	return new FeatureWebApi(cfg.port)
}

function loadFeatureBasicWebApiMethods(entry: FeatureConfigBaseType): FeatureBasicWebApiMethods {
	const Config = t.type({
		webui_command_name: t.string,
		webui_url: t.string,
	})
	const result = Config.decode(entry)
	if (isLeft(result)) {
		throw PathReporter.report(result)
	}

	const cfg = result.right
	return new FeatureBasicWebApiMethods(cfg.webui_command_name, cfg.webui_url)
}

const loaders: { [key: string]: (entry: FeatureConfigBaseType) => FeatureInterface } = {
	mondai: loadFeatureMondai,
	simple_reply: loadFeatureSimpleReply,
	custom_reply: loadFeatureCustomReply,
	command_alias: loadFeatureCommandAlias,
	play_music: loadFeaturePlayMusic,
	sk: loadFeatureSk,
	web_api: loadFeatureWebApi,
	basic_web_api_methods: loadFeatureBasicWebApiMethods,
}

export class FeatureLoader {
	private readonly _features = new Map<string, FeatureInterface>()

	addEntry(entry: FeatureConfigBaseType): boolean {
		const loader = loaders[entry.feature]
		if (loader === undefined) {
			console.error(`undefined feature: ${entry.feature}`)
			return false
		}

		try {
			const feature = loader(entry)
			this._features.set(entry.id, feature)
			return true
		} catch (e) {
			console.error(e)
			return false
		}
	}

	toFeatures(): Map<string, FeatureInterface> {
		return this._features
	}
}
