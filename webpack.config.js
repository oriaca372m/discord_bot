const common = require('./webpack.common.js')
const NodemonPlugin = require('nodemon-webpack-plugin')

module.exports = {
	...common,
	mode: 'development',
	cache: {
		type: 'filesystem',
		buildDependencies: {
			config: ['./webpack.common.js', './webpack.config.js'],
		},
	},
	plugins: [new NodemonPlugin()],
}
