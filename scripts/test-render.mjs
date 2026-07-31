// Unit tests for the template/markdown engine -- the most intricate logic in
// the project and the part most likely to regress silently on a toolchain bump.
//
// Runs on Node's built-in test runner with native TypeScript type stripping,
// so it needs no dependencies and no build step:  node --test scripts/
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectSectionProblems,
  FORMAT_REFERENCE,
  markdownToSafeHtml,
  renderTemplate,
} from '../src/domain/render.ts'

const sections = (pairs) =>
  Object.entries(pairs).map(([key, value], i) => ({ key, value, sort: i }))

const render = (template, pairs = {}) => renderTemplate(template, { sections: sections(pairs) })

describe('renderTemplate - substitution', () => {
  it('substitutes a known token', () => {
    assert.equal(render('Hello {name}!', { name: 'World' }).text, 'Hello World!')
  })

  it('substitutes the same token more than once', () => {
    assert.equal(render('{a}-{a}', { a: 'x' }).text, 'x-x')
  })

  it('leaves text without tokens untouched', () => {
    assert.equal(render('no tokens here').text, 'no tokens here')
  })

  it('ignores tokens with uppercase or invalid characters', () => {
    // The key grammar is /[a-z0-9-]+/, so {Name} is not a token at all.
    const result = render('{Name}', { name: 'x' })
    assert.equal(result.text, '{Name}')
    assert.deepEqual(result.issues, [])
  })
})

describe('renderTemplate - format modifiers', () => {
  it('applies lowercase', () => {
    assert.equal(render('{a:lowercase}', { a: 'Hello World' }).text, 'hello world')
  })

  it('applies uppercase', () => {
    assert.equal(render('{a:uppercase}', { a: 'Hello World' }).text, 'HELLO WORLD')
  })

  it('applies capitalized', () => {
    assert.equal(render('{a:capitalized}', { a: 'hello world' }).text, 'Hello World')
  })

  it('applies trim', () => {
    assert.equal(render('{a:trim}', { a: '  hello  ' }).text, 'hello')
  })

  it('passes an unknown modifier through unchanged', () => {
    assert.equal(render('{a:bogus}', { a: 'Hello' }).text, 'Hello')
  })

  it('keeps every FORMAT_REFERENCE row honest', () => {
    // The modal shows these example/result pairs to the user. If the engine
    // ever stops matching them, the UI is lying -- fail here instead.
    for (const row of FORMAT_REFERENCE) {
      const actual = render(`{a:${row.format}}`, { a: row.example }).text
      assert.equal(actual, row.result, `FORMAT_REFERENCE row "${row.format}" is out of date`)
    }
  })
})

describe('renderTemplate - brace escaping', () => {
  it('renders {{name}} as a literal {name}', () => {
    assert.equal(render('{{name}}', { name: 'World' }).text, '{name}')
  })

  it('does not report an issue for an escaped token', () => {
    assert.deepEqual(render('{{unknown}}').issues, [])
  })

  it('handles escaped and live tokens side by side', () => {
    assert.equal(render('{{a}} {a}', { a: 'X' }).text, '{a} X')
  })
})

describe('renderTemplate - issues', () => {
  it('marks an unknown token', () => {
    const result = render('{missing}')
    assert.equal(result.text, '«unknown:missing»')
    assert.deepEqual(result.issues, [{ type: 'unknown', key: 'missing' }])
  })

  it('marks an empty value', () => {
    const result = render('{blank}', { blank: '' })
    assert.equal(result.text, '«empty:blank»')
    assert.deepEqual(result.issues, [{ type: 'empty', key: 'blank' }])
  })

  it('treats a whitespace-only value as empty', () => {
    assert.deepEqual(render('{blank}', { blank: '   ' }).issues, [{ type: 'empty', key: 'blank' }])
  })
})

describe('renderTemplate - copyText', () => {
  it('strips empty placeholders', () => {
    assert.equal(render('a{blank}b', { blank: '' }).copyText, 'ab')
  })

  it('rewrites unknown placeholders to a plain slug', () => {
    assert.equal(render('{no-such-key}').copyText, 'unknown-no-such-key')
  })

  it('leaves resolved text alone', () => {
    assert.equal(render('Hello {name}', { name: 'World' }).copyText, 'Hello World')
  })
})

describe('renderTemplate - section interpolation', () => {
  it('expands a token nested inside a section value', () => {
    assert.equal(
      render('{greeting}', { name: 'John', greeting: 'Hello, {name}!' }).text,
      'Hello, John!',
    )
  })

  it('expands through more than one level', () => {
    const result = render('{c}', { a: 'deep', b: '{a}', c: 'value: {b}' })
    assert.equal(result.text, 'value: deep')
  })

  it('applies a modifier to an interpolated value', () => {
    assert.equal(
      render('{greeting}', { name: 'john', greeting: '{name:capitalized}' }).text,
      'John',
    )
  })

  it('terminates on a direct cycle instead of hanging', () => {
    const result = render('{a}', { a: '{b}', b: '{a}' })
    assert.equal(typeof result.text, 'string')
    assert.ok(result.text.length < 100, 'cycle must not expand without bound')
  })

  it('terminates on a self-reference', () => {
    const result = render('{a}', { a: 'x{a}' })
    assert.equal(typeof result.text, 'string')
    assert.ok(result.text.length < 100, 'self-reference must not expand without bound')
  })

  it('terminates on a three-node cycle', () => {
    const result = render('{a}', { a: '{b}', b: '{c}', c: '{a}' })
    assert.ok(result.text.length < 100)
  })
})

describe('markdownToSafeHtml - formatting', () => {
  it('renders h1, h2 and h3', () => {
    assert.equal(markdownToSafeHtml('# A'), '<h1>A</h1>')
    assert.equal(markdownToSafeHtml('## B'), '<h2>B</h2>')
    assert.equal(markdownToSafeHtml('### C'), '<h3>C</h3>')
  })

  it('renders paragraphs', () => {
    assert.equal(markdownToSafeHtml('hello'), '<p>hello</p>')
  })

  it('groups consecutive list items into one <ul>', () => {
    assert.equal(markdownToSafeHtml('- a\n- b'), '<ul><li>a</li><li>b</li></ul>')
  })

  it('closes a list before a following paragraph', () => {
    assert.equal(markdownToSafeHtml('- a\ntext'), '<ul><li>a</li></ul><p>text</p>')
  })

  it('renders bold and inline code', () => {
    assert.equal(markdownToSafeHtml('**b**'), '<p><strong>b</strong></p>')
    assert.equal(markdownToSafeHtml('`c`'), '<p><code>c</code></p>')
  })
})

describe('markdownToSafeHtml - XSS regression', () => {
  // The preview pane feeds this straight into v-html. Everything must be
  // escaped BEFORE any tag is constructed. If these fail, the app has an XSS.
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '"><script>alert(1)</script>',
    "<svg/onload=alert('xss')>",
    '<a href="javascript:alert(1)">click</a>',
  ]

  // The only tags this renderer is ever allowed to emit.
  const ALLOWED_TAGS = /<\/?(?:p|h1|h2|h3|ul|li|strong|code)>/g

  for (const attack of attacks) {
    it(`neutralises ${attack.slice(0, 30)}`, () => {
      const html = markdownToSafeHtml(attack)
      const residual = html.replace(ALLOWED_TAGS, '')

      // Angle brackets from user input must all have become entities, so no
      // attacker-controlled tag can exist. Event-handler text such as
      // "onerror=" may survive as inert visible text -- that is fine, because
      // without a live tag it can never become an attribute.
      assert.ok(!residual.includes('<'), `raw "<" survived escaping: ${residual}`)
      assert.ok(!residual.includes('>'), `raw ">" survived escaping: ${residual}`)
      assert.ok(html.includes('&lt;'), 'the payload should appear escaped')
    })
  }

  it('escapes the five HTML metacharacters', () => {
    const html = markdownToSafeHtml(`& < > " '`)
    assert.ok(html.includes('&amp;'))
    assert.ok(html.includes('&lt;'))
    assert.ok(html.includes('&gt;'))
    assert.ok(html.includes('&quot;'))
    assert.ok(html.includes('&#039;'))
  })

  it('escapes markup arriving through a rendered token', () => {
    const { text } = render('{evil}', { evil: '<script>alert(1)</script>' })
    assert.ok(!/<script/i.test(markdownToSafeHtml(text)))
  })
})

describe('collectSectionProblems', () => {
  it('accepts valid keys', () => {
    assert.deepEqual(collectSectionProblems(sections({ 'a-1': 'x', b2: 'y' })), [])
  })

  it('rejects an empty key', () => {
    const problems = collectSectionProblems([{ key: '', value: 'x', sort: 0 }])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /cannot be empty/)
  })

  it('rejects invalid characters', () => {
    const problems = collectSectionProblems([{ key: 'Bad Key', value: 'x', sort: 0 }])
    assert.match(problems[0], /Invalid section key/)
  })

  it('reports duplicate keys', () => {
    const problems = collectSectionProblems([
      { key: 'a', value: '1', sort: 0 },
      { key: 'a', value: '2', sort: 1 },
    ])
    assert.ok(problems.some((p) => /Duplicate section key/.test(p)))
  })
})
