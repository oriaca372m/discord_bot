const common = require('./webpack.common.js')
const NodemonPlugin = require('nodemon-webpack-plugin')

module.exports = {
	...common,
	mode: 'development',
	module: {
		...common.module,
		rules: [
			{
				enforce: 'pre',
				test: /\.(ts|js)$/,
				exclude: /node_modules/,
				loader: 'eslint-loader',
				options: {
					fix: true
				}
			},
			...common.module.rules
		]
	},
	plugins: [
		new NodemonPlugin({
			nodeArgs: ['-r', 'dotenv/config']
		})
	]
}
