#!/usr/bin/env node

require('source-map-support/register')
const { join } = require('path')
const { getRenderArguments, ls } = require('../dist/fixtures/case')
const fs = require('fs')

function renderBySource (caseName) {
    const caseItem = ls().find(item => item.caseName === caseName)
    const caseRoot = caseItem.caseRoot

    const ssrSpecPath = join(caseRoot, `${caseName}/ssr-spec.js`)
    let ssrSpec
    if (fs.existsSync(ssrSpecPath)) {
        ssrSpec = require(ssrSpecPath)
    }

    const render = require(join(caseRoot, `${caseName}/output/ssr.js`))
    const html = render(...getRenderArguments(caseName, caseRoot, ssrSpec.info || {}))

    return html
}

module.exports = {
    renderBySource
}
