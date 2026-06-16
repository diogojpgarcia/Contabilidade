import { describe, it, expect } from 'vitest';
import { readJsonStringField, tryParseJsonObject } from '../src/utils/streamParse.js';

describe('readJsonStringField — prosa a fluir durante streaming', () => {
  it('lê um campo já terminado', () => {
    expect(readJsonStringField('{"summary":"olá mundo","x":1}', 'summary')).toBe('olá mundo');
  });
  it('lê um campo ainda truncado (streaming)', () => {
    expect(readJsonStringField('{"summary":"olá mun', 'summary')).toBe('olá mun');
  });
  it('resolve aspas e quebras de linha escapadas', () => {
    expect(readJsonStringField('{"narrative":"ele disse \\"oi\\"\\nfim"}', 'narrative'))
      .toBe('ele disse "oi"\nfim');
  });
  it('descarta escape incompleto no fim do stream', () => {
    expect(readJsonStringField('{"summary":"abc\\', 'summary')).toBe('abc');
  });
  it('devolve undefined se o campo ainda não chegou', () => {
    expect(readJsonStringField('{"summary":"x"}', 'narrative')).toBeUndefined();
    expect(readJsonStringField('', 'summary')).toBeUndefined();
  });
  it('não confunde a chave com texto dentro de outro valor', () => {
    // "narrative" aparece dentro do valor de summary, mas não como chave
    expect(readJsonStringField('{"summary":"fala de narrative aqui","narrative":"real"}', 'narrative'))
      .toBe('real');
  });
});

describe('tryParseJsonObject', () => {
  it('faz parse quando o objeto está completo', () => {
    expect(tryParseJsonObject('preamble {"a":1} trailing')).toEqual({ a: 1 });
  });
  it('devolve null com JSON incompleto', () => {
    expect(tryParseJsonObject('{"a":1')).toBeNull();
    expect(tryParseJsonObject('sem chavetas')).toBeNull();
  });
});
