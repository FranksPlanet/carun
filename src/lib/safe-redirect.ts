// Guards post-sign-in redirects: only same-origin, single-slash relative paths
// are allowed. Anything protocol-relative ("//host", "/\host") or absolute is
// rejected so a crafted ?next= cannot bounce a signed-in user off-site.
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  // Reject control characters and whitespace that browsers strip when parsing URLs.
  if (/[\u0000-\u001F\u007F\s]/.test(raw)) return undefined;
  if (!raw.startsWith("/")) return undefined;
  // After the leading slash, neither "/" nor "\" may follow.
  const second = raw[1];
  if (second === "/" || second === "\\") return undefined;
  // Normalise backslashes anywhere else: browsers treat them as path separators.
  const normalised = raw.replace(/\\/g, "/");
  if (normalised.startsWith("//")) return undefined;
  return normalised;
}
