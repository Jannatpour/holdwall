/**
 * Output Encoder
 * 
 * Context-aware output encoding for XSS prevention
 */

/**
 * Encode HTML entities
 */
export function encodeHtml(input: string): string {
  const entityMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
  };

  return input.replace(/[&<>"'/]/g, (char) => entityMap[char] || char);
}

/**
 * Encode for HTML attribute context
 */
export function encodeHtmlAttribute(input: string): string {
  // More aggressive encoding for attributes
  return encodeHtml(input)
    .replace(/ /g, "&#32;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;")
    .replace(/\t/g, "&#9;");
}

/**
 * Encode for JavaScript context
 */
export function encodeJavaScript(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\//g, "\\/");
}

/**
 * Encode for URL context
 */
export function encodeUrl(input: string): string {
  return encodeURIComponent(input);
}

/**
 * Encode for CSS context
 */
export function encodeCss(input: string): string {
  // CSS encoding: escape special characters
  return input.replace(/[<>'"]/g, (char) => {
    const code = char.charCodeAt(0);
    return `\\${code.toString(16)} `;
  });
}

/**
 * Context-aware encoding
 */
export function encodeForContext(
  input: string,
  context: "html" | "html-attribute" | "javascript" | "url" | "css"
): string {
  switch (context) {
    case "html":
      return encodeHtml(input);
    case "html-attribute":
      return encodeHtmlAttribute(input);
    case "javascript":
      return encodeJavaScript(input);
    case "url":
      return encodeUrl(input);
    case "css":
      return encodeCss(input);
    default:
      return encodeHtml(input); // Default to HTML encoding
  }
}

/**
 * Safe JSON stringify (prevents XSS in JSON responses)
 */
export function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\/");
}
