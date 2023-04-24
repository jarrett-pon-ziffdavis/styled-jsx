import {
  compile,
  serialize,
  stringify,
  middleware,
  prefixer,
  namespace,
  rulesheet
} from 'stylis'

function disableNestingPlugin(...args) {
  let [context, , , parent = [], line, column] = args
  if (context === 2) {
    // replace null characters and trim
    // eslint-disable-next-line no-control-regex
    parent = (parent[0] || '').replace(/\u0000/g, '').trim()
    if (parent.length > 0 && parent.charAt(0) !== '@') {
      throw new Error(
        `Nesting detected at ${line}:${column}. ` +
          'Unfortunately nesting is not supported by styled-jsx.'
      )
    }
  }
}

let generator
let filename
let offset

function sourceMapsPlugin(...args) {
  const [context, , , , line, column, length] = args

  // Pre-processed, init source map
  if (context === -1 && generator !== undefined) {
    generator.addMapping({
      generated: {
        line: 1,
        column: 0
      },
      source: filename,
      original: offset
    })

    return
  }

  // Post-processed
  if (context === -2 && generator !== undefined) {
    generator = undefined
    offset = undefined
    filename = undefined

    return
  }

  // Selector/property, update source map
  if ((context === 1 || context === 2) && generator !== undefined) {
    generator.addMapping({
      generated: {
        line: 1,
        column: length
      },
      source: filename,
      original: {
        line: line + offset.line,
        column: column + offset.column
      }
    })
  }
}

/**
 * splitRulesPlugin
 * Used to split a blob of css into an array of rules
 * that can inserted via sheet.insertRule
 */
let splitRules = []

const splitRulesPlugin = rulesheet(rule => {
  splitRules.push(rule)
})

/**
 * Public transform function
 *
 * @param {String} hash
 * @param {String} styles
 * @param {Object} settings
 * @return {string}
 */
function transform(hash, styles, settings = {}) {
  generator = settings.generator
  offset = settings.offset
  filename = settings.filename
  splitRules = []

  const plugins = [disableNestingPlugin, sourceMapsPlugin]
  if (typeof settings.vendorPrefixes !== 'boolean' || settings.vendorPrefixes) {
    plugins.push(prefixer)
  }
  plugins.push(namespace, stringify, splitRulesPlugin)

  serialize(compile(`${hash}{${styles}}`), middleware(plugins))

  if (settings.splitRules) {
    return splitRules
  }

  return splitRules.join('')
}

export default transform
