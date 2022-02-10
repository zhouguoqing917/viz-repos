const { baseConfig, COMMON_EXTERNALS } = require("@viz/webpack-build-scripts");
const path = require("path");

module.exports = Object.assign({}, baseConfig, {
    entry: {
        main: "./src/frontend/index.ts",
    },

    externals: COMMON_EXTERNALS,

    output: {
        filename: "bundle.js",
        libraryTarget: "umd",
        path: path.resolve(__dirname, "./dist"),
    },  
});


module.exports = config;
