/** Offline, source-derived public declaration reference. Never imports SDK runtime code. */
import ts from 'typescript';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relative = (file: string) => path.relative(root, file).replaceAll('\\', '/');
const entry = path.join(root, 'src/index.ts');
const output = path.join(root, 'docs/api-reference.md');
const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const program = ts.createProgram([entry], {
  ...config.options, declaration: true, emitDeclarationOnly: true, noEmit: false,
  noEmitOnError: true, declarationMap: false, removeComments: false,
});
const checker = program.getTypeChecker();
const files = program.getSourceFiles().filter(file => !file.isDeclarationFile && relative(file.fileName).startsWith('src/'))
  .sort((a, b) => relative(a.fileName).localeCompare(relative(b.fileName), 'en'));
const emitted = new Map<string, string>();
const result = program.emit(undefined, (file, text, _bom, _error, sources) => {
  if (file.endsWith('.d.ts')) for (const source of sources ?? []) emitted.set(relative(source.fileName), text.trim());
}, undefined, true);
const errors = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics].filter(d => d.category === ts.DiagnosticCategory.Error);
if (errors.length || result.emitSkipped) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
}
const sourceLink = (node: ts.Node) => {
  const file = node.getSourceFile();
  const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  return `[${relative(file.fileName)}:${line}](../${relative(file.fileName)}#L${line})`;
};
const anchor = (file: string) => `module-${file.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
const resolve = (symbol: ts.Symbol) => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
const entrySource = program.getSourceFile(entry)!;
const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(entrySource)!)
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
const publicNode = (node: ts.Node) => {
  const flags = ts.canHaveModifiers(node) ? ts.getCombinedModifierFlags(node as ts.Declaration) : 0;
  return !(flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) &&
    !('name' in node && node.name && ts.isPrivateIdentifier(node.name as ts.Node));
};
const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
const typeText = (type: ts.Type, node?: ts.Node) => checker.typeToString(type, node, flags);
const fence = (text: string) => `\n\`\`\`ts\n${text}\n\`\`\`\n`;
const tableCell = (text: string) => text.replaceAll('|', '&#124;').replaceAll('\n', ' ');
const sections: string[] = [];
let fields = 0;
let defaults = 0;
let classes = 0;
let memberCount = 0;
let constructors = 0;

for (const source of files) {
  const file = relative(source.fileName);
  const declaration = emitted.get(file);
  if (!declaration) throw new Error(`Missing declaration emission for ${file}`);
  const parsed = ts.createSourceFile('reference.d.ts', declaration, ts.ScriptTarget.Latest, true);
  const count = (node: ts.Node) => {
    if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) || ts.isEnumMember(node) || ts.isIndexSignatureDeclaration(node)) fields++;
    ts.forEachChild(node, count);
  };
  count(parsed);
  sections.push(`<a id="${anchor(file)}"></a>\n\n## ${file}\n\nSource: [${file}](../${file}).\n${fence(declaration)}`);

  // Declaration emit intentionally removes parameter initializers. Record source defaults separately.
  const initializers: string[] = [];
  const visitDefaults = (node: ts.Node) => {
    if (!publicNode(node)) return;
    if (ts.isParameter(node) && node.initializer) {
      defaults++;
      const owner = node.parent;
      const ownerName = 'name' in owner && owner.name ? (owner.name as ts.Node).getText(source) : 'constructor/call';
      initializers.push(`- ${sourceLink(node)} — \`${ownerName}.${node.name.getText(source)}\` = \`${node.initializer.getText(source).replaceAll('`', '\\`').replaceAll(/\s+/g, ' ')}\``);
    }
    // Do not traverse implementation bodies or variable initializers.
    if (ts.isBlock(node)) return;
    if (ts.isVariableDeclaration(node)) { if (node.type) visitDefaults(node.type); return; }
    ts.forEachChild(node, visitDefaults);
  };
  visitDefaults(source);
  if (initializers.length) sections.push(`### Source parameter defaults\n\n${initializers.join('\n')}\n`);
}

const classSections: string[] = [];
for (const exported of exports) {
  const symbol = resolve(exported);
  const declaration = symbol.declarations?.find(ts.isClassDeclaration);
  if (!declaration) continue;
  classes++;
  const instance = checker.getDeclaredTypeOfSymbol(symbol);
  const statics = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  const lines: string[] = [];
  for (const signature of statics.getConstructSignatures()) {
    constructors++;
    const abstract = ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Abstract ? 'abstract ' : '';
    lines.push(`${abstract}new ${exported.name}${checker.signatureToString(signature, declaration, flags)};`);
  }
  classSections.push(`### ${exported.name}\n\n${sourceLink(declaration)}\n${lines.length ? fence(lines.join('\n')) : '\nNo public construct signature.\n'}`);
  for (const [label, type] of [['Instance', instance], ['Static', statics]] as const) {
    for (const member of checker.getPropertiesOfType(type)) {
      if (member.name === 'prototype') continue;
      const declarations = member.declarations ?? [];
      if (declarations.length && !declarations.some(publicNode)) continue;
      const origin = member.valueDeclaration ?? declarations[0];
      if (!origin) continue;
      memberCount++;
      const memberType = checker.getTypeOfSymbolAtLocation(member, declaration);
      const signatures = memberType.getCallSignatures();
      const optional = member.flags & ts.SymbolFlags.Optional ? '?' : '';
      const prefix = label === 'Static' ? 'static ' : '';
      const text = signatures.length
        ? signatures.map(signature => `${prefix}${member.name}${optional}${checker.signatureToString(signature, declaration, flags)};`).join('\n')
        : `${prefix}${member.name}${optional}: ${typeText(memberType, declaration)};`;
      // The module declaration above remains authoritative for readonly/get/set modifiers and JSDoc.
      classSections.push(`**${label} \`${member.name}\`** — ${sourceLink(origin)}${fence(text)}`);
    }
  }
}

const guides = [
  ['../README.md', 'Getting started and usage'],
  ['./authentication.md', 'Authentication and profiles'],
  ['./transport.md', 'Transport and request behavior'],
  ['./comment-identifiers.md', 'Comment identifiers and targeting'],
  ['./api-pagination-contracts.md', 'Pagination and response contracts'],
  ['./article-video-read-safety.md', 'Article and video read behavior'],
  ['./history-safety.md', 'History behavior'],
  ['./user-lists.md', 'User lists'],
];
for (const [link] of guides) if (!existsSync(path.resolve(path.dirname(output), link))) throw new Error(`Missing guide: ${link}`);
const index = exports.map(exported => {
  const symbol = resolve(exported);
  const declaration = symbol.declarations?.[0];
  if (!declaration) throw new Error(`Missing source for public export ${exported.name}`);
  const file = relative(declaration.getSourceFile().fileName);
  if (!emitted.has(file)) throw new Error(`Public export ${exported.name} lacks declaration inventory`);
  return `| \`${exported.name}\` | ${tableCell(ts.SyntaxKind[declaration.kind])} | ${sourceLink(declaration)} | [Declaration](#${anchor(file)}) |`;
});
const summary = `${exports.length} root exports; ${files.length} source modules; ${classes} exported classes; ${memberCount} effective public class member entries; ${constructors} construct signatures; ${fields} declaration field/index/enum nodes (including nested fields); ${defaults} source parameter defaults`;
const document = `# Public API declaration reference

Generated by [scripts/generate-api-reference.ts](../scripts/generate-api-reference.ts) from current [src/index.ts](../src/index.ts) and its source dependency graph, using TypeScript ${ts.version}. Do not edit this generated file directly. Existing dist declarations are **not** used. SDK code is never executed.

## Regenerate and check (offline)

With the repository's development dependencies already installed:

\`\`\`sh
node --import tsx scripts/generate-api-reference.ts
node --import tsx scripts/generate-api-reference.ts --check
\`\`\`

The check command fails if this file is absent or differs byte-for-byte from current source emission. Neither command builds dist, contacts Bilibili, logs in, or runs examples. The compiler checks the reachable source graph before emitting declarations in memory.

## Scope and interpretation

- The root export index is the package import surface. Module inventories include all emitted declarations in reachable source modules, including supporting/module-only exports; those extra names are **not** claimed to be root imports. The root index is authoritative for importability.
- Full declaration blocks retain overloads, generic constraints, union/literal/null/undefined types, optional markers, nested object fields, index signatures, enums, accessors, parameter names/order, return types, and existing declaration JSDoc. Declaration-only private/protected markers are not public operations.
- Compiler declarations omit function bodies and most value initializers. Source parameter defaults are listed separately; follow source links for runtime constant contents, implementation behavior, validation, and errors not specified in JSDoc.
- The effective class member appendix includes inherited public instance/static members and inferred constructor signatures. Generic inherited fields (for example rawData) are resolved for each subclass. Member types there are a navigation supplement; exact readonly/accessor modifiers and original JSDoc remain in the module declarations. Standard-library inherited members link to their installed declaration sources.
- This is a declaration-derived structural inventory, **not a claim of complete semantic documentation**. For fields/parameters without verified prose, their precise business meaning, units, allowed numeric codes, and runtime guarantees remain unknown here. any/unknown/index signatures are intentionally not expanded into invented schemas. Existing JSDoc is preserved, not independently certified as a server contract.
- The guide links below provide curated behavior explanations for selected areas only. No network examples were executed to generate this reference.

## Curated guides

${guides.map(([link, title]) => `- [${title}](${link})`).join('\n')}

## Coverage counts

${summary}.

Counts are mechanical: inherited members repeat per class; field/index/enum nodes count syntax nodes rather than unique business concepts. The generated export index and freshness check give a bidirectional structural mapping, not an independent semantic audit.

## Root export index

| Export | Declaration kind | Source | Inventory |
| --- | --- | --- | --- |
${index.join('\n')}

## Module declarations

${sections.join('\n')}

## Effective public class members (including inherited)

${classSections.join('\n')}
`.trimEnd() + '\n';
if (process.argv.includes('--check')) {
  if (!existsSync(output) || readFileSync(output, 'utf8') !== document) {
    console.error('API reference is missing or stale. Run the generator without --check.');
    process.exitCode = 1;
  } else console.log(`API reference is current: ${summary}.`);
} else {
  writeFileSync(output, document, 'utf8');
  console.log(`Generated docs/api-reference.md: ${summary}.`);
}
