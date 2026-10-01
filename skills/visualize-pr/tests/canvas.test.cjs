const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const vm = require('node:vm');

const skillDirectory = path.resolve(__dirname, '..');
const rendererSource = fs.readFileSync(path.join(skillDirectory, 'renderer.js'), 'utf8');
const builder = path.join(skillDirectory, 'scripts/build_canvas.py');

function createRenderer(document = {}) {
  const context = { document: { addEventListener() {}, ...document }, console };
  vm.createContext(context);
  vm.runInContext(rendererSource, context);
  return context;
}
function render(patch, options) {
  const target = { innerHTML: '' };
  createRenderer().renderDiff(target, patch, options);
  return target.innerHTML;
}
function rows(html) {
  const pattern = /<tr class="([^"]+)"><td class="diff-ln">(\d*)<\/td><td class="diff-ln">(\d*)<\/td><td class="diff-code">(.*?)<\/td><\/tr>/g;
  return [...html.matchAll(pattern)].map((match) => ({
    type: match[1], oldLine: match[2] ? Number(match[2]) : null,
    newLine: match[3] ? Number(match[3]) : null, code: match[4],
  }));
}
function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function build(t, files, body = '', directory = workspace(t)) {
  fs.writeFileSync(path.join(directory, 'files.json'), JSON.stringify(files));
  fs.writeFileSync(path.join(directory, 'body.html'), body);
  const result = spawnSync('python3', [builder,
    '--files', path.join(directory, 'files.json'), '--body', path.join(directory, 'body.html'),
    '--output-root', path.join(directory, 'artifacts')], { cwd: directory, encoding: 'utf8' });
  if (result.status !== 0) return { result, directory };
  const output = result.stdout.trim();
  const html = fs.readFileSync(output, 'utf8');
  const payload = html.match(/<script id="pr-diffs-json"[^>]*>([\s\S]*?)<\/script>/)[1];
  return { result, directory, output, html, payload, patches: JSON.parse(payload) };
}
function assertBuild(artifact) { assert.equal(artifact.result.status, 0, artifact.result.stderr); }

const importsPatch = [
  '@@ -1,4 +1,5 @@', '-import Old', '+import New', '+import Extra',
  ' let same = 0', '-let value = 1', '+let value = 2', ' return value',
];

test('imports are visible by default and advance each source counter independently', () => {
  const output = rows(render(importsPatch));
  assert.equal(output.filter((row) => row.code.startsWith('import ')).length, 3);
  assert.equal(output.find((row) => row.code === 'let value = 1').oldLine, 3);
  assert.equal(output.find((row) => row.code === 'let value = 2').newLine, 4);
  assert.deepEqual(output.find((row) => row.code === 'return value'), {
    type: 'diff-ctx', oldLine: 4, newLine: 5, code: 'return value',
  });
});

test('explicit import hiding preserves source positions and reports its count', () => {
  const html = render(importsPatch, { hideImports: true });
  const output = rows(html);
  assert(!output.some((row) => row.code.startsWith('import ')));
  assert.equal(output.find((row) => row.code === 'let value = 1').oldLine, 3);
  assert.equal(output.find((row) => row.code === 'let value = 2').newLine, 4);
  assert(html.includes('3 import line(s) hidden'));
});

test('the import checkbox restores the complete diff without changed numbering', () => {
  const target = { innerHTML: '', querySelector() {
    return { checked: this.innerHTML.includes('type="checkbox" checked') };
  } };
  const renderer = createRenderer();
  const checkboxes = [];
  target.querySelector = function() {
    const checkbox = { checked: this.innerHTML.includes('type="checkbox" checked') };
    checkboxes.push(checkbox); return checkbox;
  };
  renderer.renderDiff(target, importsPatch);
  const complete = target.innerHTML;
  checkboxes.at(-1).checked = true; checkboxes.at(-1).onchange();
  assert(!rows(target.innerHTML).some((row) => row.code.startsWith('import ')));
  checkboxes.at(-1).checked = false; checkboxes.at(-1).onchange();
  assert.equal(target.innerHTML, complete);
});

test('side-effect imports remain changes in the default view', () => {
  const output = rows(render('@@ -1 +1 @@\n-import "./old-setup";\n+import "./new-setup";'));
  assert.deepEqual(output.filter((row) => row.type !== 'diff-hunk').map((row) => row.type), ['diff-del', 'diff-add']);
});

test('deleting an import preserves offsets and the following hunk resets them', () => {
  const output = rows(render([
    '@@ -10,2 +10,1 @@', '-import Removed', ' first()',
    '@@ -30,2 +29,2 @@', ' import Kept', '-old()', '+new()',
  ], { hideImports: true }));
  assert.deepEqual(output.find((row) => row.code === 'first()'), {
    type: 'diff-ctx', oldLine: 11, newLine: 10, code: 'first()',
  });
  assert.equal(output.find((row) => row.code === 'old()').oldLine, 31);
  assert.equal(output.find((row) => row.code === 'new()').newLine, 30);
});

test('spacing and indentation edits remain additions and deletions', () => {
  const output = rows(render(['@@ -1 +1 @@', '-let value = 1', '+let  value = 1']));
  assert.equal(output[1].type, 'diff-del');
  assert.equal(output[2].type, 'diff-add');
});

test('whitespace inside string literals is never collapsed into context', () => {
  const output = rows(render(['@@ -1 +1 @@', '-const label = "a b";', '+const label = "ab";']));
  assert.deepEqual(output.slice(1).map((row) => row.type), ['diff-del', 'diff-add']);
  assert(output[1].code.includes('a b'));
});

test('newline markers are metadata and never consume source line numbers', () => {
  const output = rows(render([
    '@@ -1 +1 @@', '-old()', '\\ No newline at end of file',
    '+new()', '\\ No newline at end of file',
  ].join('\n') + '\n'));
  const markers = output.filter((row) => row.type === 'diff-meta');
  assert.equal(markers.length, 2);
  assert(markers.every((row) => row.oldLine === null && row.newLine === null));
  assert.equal(output.find((row) => row.code === 'old()').oldLine, 1);
  assert.equal(output.find((row) => row.code === 'new()').newLine, 1);
});

test('a newline marker after context does not move later lines', () => {
  const output = rows(render(['@@ -5,2 +5,2 @@', ' same()', '\\ No newline at end of file', '-old()', '+new()']));
  assert.equal(output.find((row) => row.code === 'old()').oldLine, 6);
  assert.equal(output.find((row) => row.code === 'new()').newLine, 6);
});

test('code resembling file headers inside a hunk is still rendered', () => {
  const output = rows(render(['--- a/test', '+++ b/test', '@@ -1 +1 @@', '--- removed', '+++ added']));
  assert(output.some((row) => row.code === '-- removed' && row.oldLine === 1));
  assert(output.some((row) => row.code === '++ added' && row.newLine === 1));
  assert(output.filter((row) => row.type === 'diff-meta').every((row) => row.oldLine === null && row.newLine === null));
});

test('zero-length hunk sides and multiple hunks have independent positions', () => {
  const output = rows(render(['@@ -0,0 +1,2 @@', '+first()', '+second()', '@@ -9,1 +10,0 @@', '-gone()']));
  assert.deepEqual(output.filter((row) => row.type === 'diff-add').map((row) => row.newLine), [1, 2]);
  assert.equal(output.find((row) => row.code === 'gone()').oldLine, 9);
});

test('moved raw-identical blocks retain their positions and highlighting', () => {
  const output = rows(render([
    '@@ -1,5 +1,5 @@', ' import Foundation', '-first()', '-second()', '-third()',
    ' pivot()', '+first()', '+second()', '+third()',
  ]));
  assert.deepEqual(output.filter((row) => row.type === 'diff-moved-del').map((row) => row.oldLine), [2, 3, 4]);
  assert.deepEqual(output.filter((row) => row.type === 'diff-moved-add').map((row) => row.newLine), [3, 4, 5]);
});

test('a moved block with a literal-space edit marks that line as edited', () => {
  const output = rows(render([
    '@@ -1,5 +1,5 @@', '-first()', '-const label = "a b";', '-second()', '-third()',
    ' pivot()', '+first()', '+const label = "ab";', '+second()', '+third()',
  ]));
  assert.equal(output.find((row) => row.code === 'const label = "a b";').type, 'diff-moved-del-edited');
  assert.equal(output.find((row) => row.code === 'const label = "ab";').type, 'diff-moved-add-edited');
});

test('a same-location replacement is not labeled as moved', () => {
  const output = rows(render([
    '@@ -1,4 +1,4 @@', '-first()', '-old()', '-second()', '-third()',
    '+first()', '+new()', '+second()', '+third()',
  ]));
  assert(!output.some((row) => row.type.startsWith('diff-moved')));
});

test('view filtering does not change move classification of the remaining lines', () => {
  const patch = ['@@ -1,5 +1,5 @@', '-first()', '-import Old', '-second()', '-third()',
    ' pivot()', '+first()', '+import New', '+second()', '+third()'];
  const full = rows(render(patch)).filter((row) => !row.code.startsWith('import '));
  assert.deepEqual(rows(render(patch, { hideImports: true })), full);
});

test('rendered source text cannot introduce HTML markup', () => {
  const html = render(['@@ -0,0 +1 @@', '+<img src=x onerror="bad()"> & <script>bad()</script>']);
  assert(!html.includes('<img'));
  assert(!html.includes('<script>bad()'));
  assert(html.includes('&lt;img') && html.includes('&amp;'));
});

test('missing patches are identified as unavailable rather than unchanged', () => {
  assert(render('').includes('Text patch unavailable'));
  assert(render(null).includes('Text patch unavailable'));
});

test('the assembler keeps punctuation-distinct filenames and works from another cwd', (t) => {
  const artifact = build(t, [[
    { filename: 'src/a-b.ts', patch: 'first patch' }, { filename: 'src/a_b.ts', patch: 'second patch' },
  ]]);
  assertBuild(artifact);
  assert.deepEqual(artifact.patches, { 'src/a-b.ts': 'first patch', 'src/a_b.ts': 'second patch' });
  assert(artifact.html.includes('function renderDiff(') && artifact.html.includes('--surface-raised'));
});

test('all pages and null patches survive assembly, including empty results', (t) => {
  const artifact = build(t, [
    [{ filename: 'src/first.ts', patch: 'first patch' }],
    [{ filename: 'src/second.ts', patch: 'second patch' }, { filename: 'image.png', patch: null }],
  ]);
  assertBuild(artifact);
  assert.deepEqual(artifact.patches, { 'src/first.ts': 'first patch', 'src/second.ts': 'second patch', 'image.png': '' });
  const empty = build(t, [[]]); assertBuild(empty); assert.deepEqual(empty.patches, {});
});

test('flat files JSON is accepted without losing patches', (t) => {
  const artifact = build(t, [{ filename: 'plain.swift', patch: 'patch' }]);
  assertBuild(artifact); assert.equal(artifact.patches['plain.swift'], 'patch');
});

test('each assembly creates an isolated artifact containing only its HTML', (t) => {
  const directory = workspace(t);
  const first = build(t, [], 'First', directory), second = build(t, [], 'Second', directory);
  assertBuild(first); assertBuild(second);
  assert.notEqual(first.output, second.output);
  assert(first.html.includes('First') && second.html.includes('Second'));
  assert.deepEqual(fs.readdirSync(path.dirname(first.output)), ['index.html']);
  assert.deepEqual(fs.readdirSync(path.dirname(second.output)), ['index.html']);
});

test('filenames and patches containing closing script tags round-trip safely', (t) => {
  const filename = 'src/"<&</script>.ts';
  const patch = '@@ -0,0 +1 @@\n+const value = "</script><script>bad()</script> & \\"";';
  const artifact = build(t, [{ filename, patch }]);
  assertBuild(artifact);
  assert.equal(artifact.patches[filename], patch);
  assert(!artifact.payload.includes('<') && !artifact.payload.includes('>') && !artifact.payload.includes('&'));
  assert.equal((artifact.html.match(/<script\b/g) || []).length, 2);
});

test('template-looking source text in the body is not reinjected', (t) => {
  const body = '<pre>/* INJECT_JS */ {"__PR_DIFFS_PLACEHOLDER__":true}</pre>';
  const artifact = build(t, [], body);
  assertBuild(artifact); assert(artifact.html.includes(body));
});

test('invalid files JSON or duplicate paths fail before emitting an artifact', (t) => {
  for (const files of [ {}, [{ filename: 'a', patch: 'x' }, { filename: 'a', patch: 'y' }], [{ filename: 'a', patch: 123 }] ]) {
    const artifact = build(t, files);
    assert.notEqual(artifact.result.status, 0);
    assert.equal(artifact.result.stdout, '');
    assert(!fs.existsSync(path.join(artifact.directory, 'artifacts')));
  }
});

test('auto-discovery uses exact filename keys for every file', () => {
  const patches = { 'src/a-b.ts': '@@ -1 +1 @@\n-oldFirst\n+newFirst', 'src/a_b.ts': '@@ -1 +1 @@\n-oldSecond\n+newSecond' };
  const targets = Object.keys(patches).map((filename) => ({ innerHTML: '', getAttribute() { return filename; } }));
  let onReady;
  createRenderer({
    addEventListener(event, callback) { if (event === 'DOMContentLoaded') onReady = callback; },
    getElementById() { return { textContent: JSON.stringify(patches) }; },
    querySelectorAll() { return targets; },
  });
  onReady();
  assert(targets[0].innerHTML.includes('newFirst') && !targets[0].innerHTML.includes('newSecond'));
  assert(targets[1].innerHTML.includes('newSecond') && !targets[1].innerHTML.includes('newFirst'));
});
