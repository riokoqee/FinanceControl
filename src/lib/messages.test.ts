import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as ts from 'typescript';
import { english, message, russian } from './messages';
import type { MessageKey } from './messages';
import { translate } from './i18n';
import { LocalizedError, localizeError } from './localizedError';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
const keys = Object.keys(russian) as MessageKey[];

describe('typed message resources', () => {
  it('keeps identical English and Russian key sets with nonempty values', () => {
    expect(Object.keys(english).sort()).toEqual([...keys].sort());
    const failures = keys.flatMap((key) => (['ru', 'en'] as const).flatMap((language) => {
      const text = (language === 'ru' ? russian : english)[key];
      return typeof text === 'string' && text.trim().length > 0 ? [] : [`${language}:${key}`];
    }));
    expect(failures).toEqual([]);
  });

  it('retains the same interpolation placeholders in both languages', () => {
    const failures = keys.filter((key) => placeholders(russian[key]).join(',') !== placeholders(english[key]).join(','));
    expect(failures).toEqual([]);
  });

  it('uses stable identifiers and translates known keys without source-language text as keys', () => {
    expect(message('ru', 'common.save')).toBe('Сохранить');
    expect(message('en', 'common.save')).toBe('Save');
    expect(translate('ru', 'nav.profile')).toBe('Профиль');
    expect(translate('en', 'nav.profile')).toBe('Profile');
    expect(keys.every((key) => /^[A-Za-z0-9_.-]+$/u.test(key))).toBe(true);
    expectTypeOf<'common.save'>().toExtend<MessageKey>();
    expectTypeOf<Extract<MessageKey, 'Сохранить' | 'Профиль' | 'arbitrary.unknown'>>().toEqualTypeOf<never>();
    expectTypeOf<Parameters<typeof translate>[1]>().toEqualTypeOf<MessageKey>();
  });

  it('preserves user-provided fragments verbatim rather than translating or reinterpreting them', () => {
    const userText = 'Капитан {count} <tag> "=1+1" @crew\nПродукты';
    expect(message('en', 'ui.invalidFieldFieldInTheBackup', { field: userText }))
      .toBe(`Invalid field “${userText}” in the backup.`);
    expect(message('ru', 'ui.invalidFieldFieldInTheBackup', { field: userText }))
      .toBe(`Некорректное поле «${userText}» в резервной копии.`);
    expect(message('en', 'ui.theJournalCanContainUpToCountEntries', { count: 50_000 }))
      .toBe('The journal can contain up to 50,000 entries.');
  });

  it('keeps an omitted interpolation visible instead of inserting undefined', () => {
    expect(message('en', 'ui.invalidFieldFieldInTheBackup')).toContain('{field}');
    expect(message('en', 'ui.invalidFieldFieldInTheBackup')).not.toContain('undefined');
  });

  it('localizes application field labels while keeping ordinary string parameters untouched', () => {
    expect(message('en', 'ui.invalidFieldFieldInTheBackup', { field: { key: 'field.name' } }))
      .toBe('Invalid field “Name” in the backup.');
    expect(message('ru', 'ui.invalidFieldFieldInTheBackup', { field: { key: 'field.name' } }))
      .toBe('Некорректное поле «Имя» в резервной копии.');
    const error = new LocalizedError('ui.invalidFieldFieldInTheBackup', { field: { key: 'field.name' } });
    expect(error.message).toContain('Имя');
    expect(localizeError('en', error, 'error.saveFailed')).toBe('Invalid field “Name” in the backup.');
  });
});

describe('localized domain errors', () => {
  it('stores a stable key and values while keeping the default Russian log message', () => {
    const values = { field: 'Капитан {field}' };
    const error = new LocalizedError('ui.invalidFieldFieldInTheBackup', values);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LocalizedError');
    expect(error.key).toBe('ui.invalidFieldFieldInTheBackup');
    expect(error.values).toEqual(values);
    expect(error.message).toBe('Некорректное поле «Капитан {field}» в резервной копии.');
    expect(localizeError('en', error, 'error.saveFailed')).toBe('Invalid field “Капитан {field}” in the backup.');
    expect(localizeError('ru', error, 'error.saveFailed')).toBe(error.message);
  });

  it.each([
    new Error('private path C:/Users/captain/secret'),
    new TypeError('Cannot read private object'),
    new DOMException('Native storage details', 'QuotaExceededError'),
    'Untrusted error text',
    { message: 'Untrusted error text', key: 'common.save', values: {} },
    null, undefined, 42,
  ])('uses the localized fallback for non-domain failures without leaking their text: %s', (cause) => {
    expect(localizeError('en', cause, 'error.saveFailed')).toBe(message('en', 'error.saveFailed'));
    expect(localizeError('ru', cause, 'error.saveFailed')).toBe(message('ru', 'error.saveFailed'));
  });
});

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return /\.tsx?$/u.test(entry.name) && !/\.(?:test|bench)\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}
function propertyName(name: ts.PropertyName | ts.BindingName | undefined): string | undefined {
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
}
function translatedName(expression: ts.Expression): string | undefined {
  return ts.isIdentifier(expression) ? expression.text
    : ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
}
function hasRussianLiteral(node: ts.Node): boolean {
  if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
    && /[\u0400-\u04ff]/u.test(node.text)) return true;
  return ts.forEachChild(node, (child) => hasRussianLiteral(child) || undefined) ?? false;
}
function wrapperName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return propertyName(node.name);
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return undefined;
  const parent = node.parent;
  return ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)
    ? propertyName(parent.name) : undefined;
}

describe('production translation boundaries', () => {
  it('never passes Russian source text as a tr/translate key and types every translator wrapper', () => {
    const failures: string[] = [];
    let inspectedWrappers = 0;
    for (const path of productionFiles(sourceRoot)) {
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
        path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const location = (node: ts.Node) => `${relative(sourceRoot, path)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const name = translatedName(node.expression);
          const key = name === 'tr' ? node.arguments[0] : name === 'translate' ? node.arguments[1] : undefined;
          if (key && hasRussianLiteral(key)) failures.push(`${location(node)}: Russian text used as a translation key`);
        }
        const name = wrapperName(node);
        if ((name === 'tr' || name === 'translate') && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)
          || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node))) {
          inspectedWrappers++;
          const type = node.parameters[name === 'translate' ? 1 : 0]?.type;
          if (!type || !ts.isTypeReferenceNode(type) || type.typeName.getText(source).split('.').at(-1) !== 'MessageKey') {
            failures.push(`${location(node)}: ${name} wrapper key must be typed as MessageKey`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(inspectedWrappers).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});
