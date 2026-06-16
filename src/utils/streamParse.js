/**
 * streamParse — leitura incremental de campos de texto de um JSON ainda a chegar.
 *
 * Não tenta fazer parse de JSON incompleto (impossível). Em vez disso extrai o
 * valor (possivelmente truncado) de um campo string de topo, para mostrar a
 * prosa a "fluir" durante o streaming. O parse autoritativo (estrito) é feito
 * só no fim. Puro e testável.
 */

const ESCAPES = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f' };

/**
 * Lê o valor de um campo string JSON de topo, mesmo que ainda não esteja
 * terminado (streaming). Devolve a string (já com escapes básicos resolvidos)
 * ou undefined se o campo ainda não apareceu.
 */
export function readJsonStringField(text, key) {
  if (!text || !key) return undefined;
  // Âncora: o campo é uma CHAVE (precedida de { ou ,) seguida de ": "
  const re = new RegExp(`[{,]\\s*"${key}"\\s*:\\s*"`);
  const m = re.exec(text);
  if (!m) return undefined;

  let i = m.index + m[0].length;
  let out = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      const next = text[i + 1];
      if (next === undefined) break;           // escape incompleto no fim do stream
      out += ESCAPES[next] ?? next;
      i += 2;
      continue;
    }
    if (c === '"') return out;                  // string terminada
    out += c;
    i += 1;
  }
  return out;                                   // ainda a chegar (truncada)
}

/**
 * Extrai o objeto JSON completo do texto acumulado, se já estiver íntegro.
 * Devolve o objeto ou null se ainda não houver JSON válido.
 */
export function tryParseJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  if (start < 0) return null;
  const end = text.lastIndexOf('}');
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
