const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/pages/password-reset.ts', 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
fs.writeFileSync('password-reset.js', '// Generated from src/pages/password-reset.ts. Do not edit directly.\n' + outputText);
