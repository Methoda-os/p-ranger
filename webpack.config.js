const path = require('path');

module.exports = {
    entry: './lib/',
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                loader: 'babel-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js', 'jsx' ]
    },
    output: {
        filename: 'bundle.js',
        library: 'co-ranger',
        libraryTarget: 'window',
        libraryExport: 'default',
        path: path.resolve(__dirname, 'dist')
    }
}