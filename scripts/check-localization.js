#!/usr/bin/env node
// Check actual source keys, not only en.json, which can lag behind new features.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const readJSON = (name) => JSON.parse(fs.readFileSync(path.join(root, 'app/lang', name), 'utf8'));
const chinese = { ...readJSON('zh.json'), ...readJSON('zh-CN.json') };
const english = readJSON('en.json');
const keys = new Map();
const errors = [];
let fileCount = 0;

function staticString(node) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(node.left);
    const right = staticString(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
}

function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['spec', 'specs', 'node_modules', 'quickpreview'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(file);
    } else if (/\.[jt]sx?$/.test(file)) {
      fileCount++;
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      );
      function visit(node) {
        if (
          ts.isCallExpression(node) &&
          ['localized', 'localizedReactFragment'].includes(node.expression.getText(source))
        ) {
          const location = `${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
          const key = staticString(node.arguments[0]);
          if (key === undefined)
            errors.push(`${location}: translation key must be a static string`);
          else if (!keys.has(key)) keys.set(key, location);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}

function placeholders(value) {
  let index = 0;
  return [...value.matchAll(/%(?:(\d+)\$)?@/g)]
    .map((match) => (match[1] ? Number(match[1]) : ++index))
    .sort((a, b) => a - b)
    .join(',');
}

for (const directory of ['app/src', 'app/internal_packages', 'app/menus'])
  scan(path.join(root, directory));
for (const [key, location] of keys) {
  if (!Object.prototype.hasOwnProperty.call(english, key))
    errors.push(`${location}: missing English source key: ${key}`);
  if (typeof chinese[key] !== 'string' || !chinese[key].trim()) {
    errors.push(`${location}: missing Simplified Chinese translation: ${key}`);
  } else if (placeholders(key) !== placeholders(chinese[key])) {
    errors.push(`${location}: Chinese placeholders differ from source: ${key}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${keys.size} source keys across ${fileCount} files: Chinese coverage and placeholders OK.`
  );
}
