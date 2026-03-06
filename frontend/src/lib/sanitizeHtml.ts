const BLOCK_TAG_RE = /<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SELF_CLOSING_BLOCK_TAG_RE = /<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi;
const EVENT_HANDLER_ATTR_RE = /\son[a-z0-9_-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const JS_PROTOCOL_ATTR_RE = /\s(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi;

export const sanitizeHtml = (input: string): string =>
  (input || "")
    .replace(BLOCK_TAG_RE, "")
    .replace(SELF_CLOSING_BLOCK_TAG_RE, "")
    .replace(EVENT_HANDLER_ATTR_RE, "")
    .replace(JS_PROTOCOL_ATTR_RE, ' $1="#"')
    .trim();
