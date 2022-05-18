import * as discordjs from 'discord.js'

import { FeatureBase, FeatureEventContext, FeatureEventResult } from 'Src/features/feature'
import { FeatureCommand } from 'Src/features/command'
import { StorageDriver, FeatureStorage } from 'Src/features/storage'
import { FeatureGlobalConfig } from 'Src/features/global-config'
import { FeatureWebApi } from 'Src/features/webapi'

export default class extends FeatureBase {
	public gc!: FeatureGlobalConfig

	protected featureCommand!: FeatureCommand
	protected featureStorage!: FeatureStorage
	protected featureWebApi: FeatureWebApi | undefined
	public storageDriver!: StorageDriver

	protected preInitImpl(): void {
		this.gc = this.manager.getFeature<FeatureGlobalConfig>('gc')
		this.featureCommand = this.manager.registerFeature('command', () => new FeatureCommand())
		this.featureStorage = this.manager.registerFeature('storage', () => new FeatureStorage())
		this.storageDriver = this.featureStorage.getStorageDriver(this)
		this.featureWebApi = this.manager.getFeature<FeatureWebApi>('webapi')
	}

	onMessage(msg: discordjs.Message, context: FeatureEventContext): FeatureEventResult {
		return {
			continuation: async (): Promise<void> => {
				await this.onMessageImpl(msg, context)
			},
		}
	}

	protected async onMessageImpl(
		_msg: discordjs.Message,
		_context: FeatureEventContext
	): Promise<void> {
		return Promise.resolve()
	}
}
