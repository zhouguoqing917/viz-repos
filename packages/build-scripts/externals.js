 

module.exports = externalize({
    "@viz/core": ["viz", "core"], 
    "classnames": "classNames", 
    "react": "React",
    "react-day-picker": "DayPicker",
    "react-dom": "ReactDOM",
    "react-popper": "ReactPopper",
    "react-transition-group": "ReactTransitionGroup",
    "resize-observer-polyfill": "ResizeObserver",
    "tslib": "window",
});

/**
 * Generates a full webpack `external` listing declaring names for various module formats.
 * @param {Record<string, string | string[]>} externals
 */
function externalize(externals) {
    const newExternals = {}
    for (const pkgName in externals) {
        if (externals.hasOwnProperty(pkgName)) {
            newExternals[pkgName] = {
                commonjs: pkgName,
                commonjs2: pkgName,
                amd: pkgName,
                root: externals[pkgName],
            }
        }
    }
    return newExternals;
}
