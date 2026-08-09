import React from 'react';

/**
 * Tokenizes and highlights JSON text with clean Tailwind syntax colors.
 */
export function highlightJson(jsonStr: string): React.ReactNode {
  if (!jsonStr) return null;

  // Tokenizer regex for JSON
  const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\]:,])/g;

  let lastIndex = 0;
  const nodes: React.ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(jsonStr)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(jsonStr.substring(lastIndex, match.index));
    }

    const token = match[0];
    const key = `tok_${lastIndex}_${match.index}`;

    if (/^"/.test(token)) {
      if (/:$/.test(token)) {
        // JSON key
        const colonIdx = token.lastIndexOf(':');
        const keyText = token.substring(0, colonIdx);
        const colonText = token.substring(colonIdx);
        nodes.push(
          <span key={key} className="text-sky-300 font-medium">
            {keyText}
          </span>
        );
        nodes.push(
          <span key={`${key}_col`} className="text-slate-500">
            {colonText}
          </span>
        );
      } else {
        // String value
        nodes.push(
          <span key={key} className="text-emerald-300">
            {token}
          </span>
        );
      }
    } else if (/^(true|false)$/.test(token)) {
      nodes.push(
        <span key={key} className="text-purple-400 font-semibold">
          {token}
        </span>
      );
    } else if (/^null$/.test(token)) {
      nodes.push(
        <span key={key} className="text-rose-400 font-semibold italic">
          {token}
        </span>
      );
    } else if (/^-?\d/.test(token)) {
      nodes.push(
        <span key={key} className="text-amber-400 font-mono">
          {token}
        </span>
      );
    } else {
      nodes.push(
        <span key={key} className="text-slate-400">
          {token}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < jsonStr.length) {
    nodes.push(jsonStr.substring(lastIndex));
  }

  return <>{nodes}</>;
}

/**
 * Tokenizes JS / Scripting snippets (pm.test, pm.environment, console.log, etc.)
 */
export function highlightJs(jsStr: string): React.ReactNode {
  if (!jsStr) return null;

  const lines = jsStr.split('\n');
  return (
    <>
      {lines.map((line, idx) => {
        // Line comments
        if (line.trim().startsWith('//')) {
          return (
            <React.Fragment key={idx}>
              <span className="text-slate-500 italic">{line}</span>
              {idx < lines.length - 1 && '\n'}
            </React.Fragment>
          );
        }

        // Tokenize line
        const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"|'(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\'])*'|`(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\`])*`|\b(const|let|var|function|return|if|else|async|await|try|catch|new|of|in)\b|\b(pm|console|environment|request|response|test|expect|globals|variables)\b|\b(true|false|null|undefined)\b|-?\d+(?:\.\d*)?)/g;

        let lastIndex = 0;
        const lineNodes: React.ReactNode[] = [];
        let match: RegExpExecArray | null;

        while ((match = tokenRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            lineNodes.push(line.substring(lastIndex, match.index));
          }

          const token = match[0];
          const k = `js_${idx}_${lastIndex}_${match.index}`;

          if (/^['"`]/.test(token)) {
            lineNodes.push(
              <span key={k} className="text-emerald-300">
                {token}
              </span>
            );
          } else if (/^(const|let|var|function|return|if|else|async|await|try|catch|new|of|in)$/.test(token)) {
            lineNodes.push(
              <span key={k} className="text-purple-400 font-semibold">
                {token}
              </span>
            );
          } else if (/^(pm|console|environment|request|response|test|expect|globals|variables)$/.test(token)) {
            lineNodes.push(
              <span key={k} className="text-sky-300 font-semibold">
                {token}
              </span>
            );
          } else if (/^(true|false|null|undefined)$/.test(token)) {
            lineNodes.push(
              <span key={k} className="text-amber-400 font-medium">
                {token}
              </span>
            );
          } else if (/^-?\d/.test(token)) {
            lineNodes.push(
              <span key={k} className="text-amber-300 font-mono">
                {token}
              </span>
            );
          } else {
            lineNodes.push(token);
          }

          lastIndex = tokenRegex.lastIndex;
        }

        if (lastIndex < line.length) {
          lineNodes.push(line.substring(lastIndex));
        }

        return (
          <React.Fragment key={idx}>
            {lineNodes}
            {idx < lines.length - 1 && '\n'}
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Smart JSON Formatter that safely handles REST Client variable placeholders like {{variable}} (both quoted and unquoted).
 */
export function smartFormatJson(rawText: string, indent = 2): { formatted: string; error?: string } {
  if (!rawText || !rawText.trim()) return { formatted: '' };

  // 1. Try direct JSON parsing
  try {
    const parsed = JSON.parse(rawText);
    return { formatted: JSON.stringify(parsed, null, indent) };
  } catch (e1) {
    // 2. Try smart variable replacement for REST Client template variables
    try {
      const varMap = new Map<string, { orig: string; isQuoted: boolean }>();
      let counter = 0;

      // Replace quoted variables: "{{varName}}" -> "__REST_VAR_Q_0__"
      let replaced = rawText.replace(/"\{\{([a-zA-Z0-9_.-]+)\}\}"/g, (match) => {
        const placeholder = `__REST_VAR_Q_${counter++}__`;
        varMap.set(placeholder, { orig: match, isQuoted: true });
        return `"${placeholder}"`;
      });

      // Replace unquoted variables: {{varName}} -> "__REST_VAR_U_0__"
      replaced = replaced.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (match) => {
        const placeholder = `__REST_VAR_U_${counter++}__`;
        varMap.set(placeholder, { orig: match, isQuoted: false });
        return `"${placeholder}"`;
      });

      const parsed = JSON.parse(replaced);
      let formatted = JSON.stringify(parsed, null, indent);

      varMap.forEach((info, placeholder) => {
        if (info.isQuoted) {
          formatted = formatted.replace(new RegExp(`"${placeholder}"`, 'g'), info.orig);
        } else {
          formatted = formatted.replace(new RegExp(`"${placeholder}"`, 'g'), info.orig);
          formatted = formatted.replace(new RegExp(placeholder, 'g'), info.orig);
        }
      });

      return { formatted };
    } catch (e2: any) {
      return { formatted: rawText, error: e2.message || 'Invalid JSON syntax' };
    }
  }
}

/**
 * Validates whether string is valid JSON or valid JSON with {{vars}}.
 */
export function validateJsonSyntax(rawText: string): { isValid: boolean; hasVars: boolean; error?: string } {
  if (!rawText || !rawText.trim()) return { isValid: true, hasVars: false };

  const hasVars = /\{\{[a-zA-Z0-9_.-]+\}\}/.test(rawText);

  try {
    JSON.parse(rawText);
    return { isValid: true, hasVars };
  } catch (e1: any) {
    if (hasVars) {
      const res = smartFormatJson(rawText);
      if (!res.error) {
        return { isValid: true, hasVars: true };
      }
      return { isValid: false, hasVars: true, error: res.error };
    }
    return { isValid: false, hasVars: false, error: e1.message };
  }
}

/**
 * Tokenizes .rest / HTTP Client file syntax.
 */
export function highlightRestSyntax(restStr: string): React.ReactNode {
  if (!restStr) return null;

  const lines = restStr.split('\n');
  return (
    <>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Comment or separator
        if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
          return (
            <React.Fragment key={idx}>
              <span className="text-slate-500 italic">{line}</span>
              {idx < lines.length - 1 && '\n'}
            </React.Fragment>
          );
        }

        // Variable declaration @var = val
        if (trimmed.startsWith('@')) {
          const eqIdx = line.indexOf('=');
          if (eqIdx !== -1) {
            const varName = line.substring(0, eqIdx);
            const varVal = line.substring(eqIdx + 1);
            return (
              <React.Fragment key={idx}>
                <span className="text-emerald-400 font-mono font-semibold">{varName}</span>
                <span className="text-slate-500">=</span>
                <span className="text-amber-300 font-mono">{varVal}</span>
                {idx < lines.length - 1 && '\n'}
              </React.Fragment>
            );
          }
        }

        // Method & URL
        const httpMatch = line.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+(.+)$/i);
        if (httpMatch) {
          const method = httpMatch[1].toUpperCase();
          const url = httpMatch[2];

          let methodColor = 'text-emerald-400';
          if (method === 'POST') methodColor = 'text-sky-400';
          if (method === 'PUT') methodColor = 'text-amber-400';
          if (method === 'DELETE') methodColor = 'text-rose-400';
          if (method === 'PATCH') methodColor = 'text-purple-400';

          return (
            <React.Fragment key={idx}>
              <span className={`font-bold font-mono ${methodColor}`}>{method}</span>
              <span> </span>
              <span className="text-indigo-300 font-mono">{url}</span>
              {idx < lines.length - 1 && '\n'}
            </React.Fragment>
          );
        }

        // Default line with {{variable}} highlighting
        const parts = line.split(/(\{\{[^}]+\}\})/g);
        return (
          <React.Fragment key={idx}>
            {parts.map((p, pIdx) => {
              if (p.startsWith('{{') && p.endsWith('}}')) {
                return (
                  <span key={pIdx} className="text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-0.5 rounded">
                    {p}
                  </span>
                );
              }
              return p;
            })}
            {idx < lines.length - 1 && '\n'}
          </React.Fragment>
        );
      })}
    </>
  );
}
