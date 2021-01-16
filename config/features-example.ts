import { FeatureInterface } from '../src/features/feature'
import { FeatureSimpleReply } from '../src/features/simple-reply'
import { FeatureCustomReply } from '../src/features/custom-reply'
import FeatureCommandAlias from '../src/features/command-alias'
import { FeaturePlayMusic } from '../src/features/play-music'
import { FeatureSk } from '../src/features/sk'
import { FeatureWebApi } from '../src/features/webapi'
import { FeatureBasicWebApiMethods } from '../src/features/basic-webapi-methods'

const features = new Map<string, FeatureInterface>()

features.set('webapi', new FeatureWebApi(25565))
features.set(
	'basicWebApiMethods',
	new FeatureBasicWebApiMethods('webui', 'https://oriaca372m.github.io/webui_discord_bot/')
)

features.set('simpleReply', new FeatureSimpleReply())

features.set('customReply', new FeatureCustomReply('res'))
features.set('aliasRls', new FeatureCommandAlias('rls', 'res', ['images', 'list']))
features.set('aliasRp', new FeatureCommandAlias('rp', 'res', ['images', 'preview']))
features.set('aliasRu', new FeatureCommandAlias('ru', 'res', ['images', 'upload']))

features.set('playMusic', new FeaturePlayMusic('music'))

features.set('sk', new FeatureSk('!sk', 'setsk'))

export default features
