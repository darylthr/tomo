import { resolveUrl } from './config';

export type ServerErrorKind = 'unreachable' | 'auth' | 'version' | 'server';

const MESSAGES: Record<ServerErrorKind, string> = {
  unreachable: "Can't reach your server",
  auth: 'Your server needs a login',
  version: "This Suwayomi version isn't supported",
  server: 'The server returned an error',
};

export class ServerError extends Error {
  constructor(
    public kind: ServerErrorKind,
    public details?: string,
  ) {
    super(MESSAGES[kind]);
    this.name = 'ServerError';
  }
}

// GraphQL validation errors that mean the server's schema doesn't have what Tomo asks for.
const SCHEMA_MISMATCH = /FieldUndefined|Cannot query field|Unknown type|is undefined|is not defined|UnknownArgument|WrongType/i;

/** Runs a GraphQL operation against Suwayomi and maps failures to a ServerError. */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  opts: { signal?: AbortSignal; keepalive?: boolean } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(resolveUrl('/api/graphql'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: opts.signal,
      keepalive: opts.keepalive,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ServerError('unreachable', e instanceof Error ? e.message : undefined);
  }

  if (res.status === 401 || res.status === 403) throw new ServerError('auth');

  let body: { data?: T; errors?: { message: string }[] };
  try {
    body = await res.json();
  } catch {
    throw new ServerError(res.ok ? 'server' : 'unreachable', `HTTP ${res.status}`);
  }

  // GraphQL can answer with data and errors for a few fields (an uninstalled source, say);
  // keep the data when every top-level field arrived.
  const complete = !!body.data && Object.values(body.data as object).every((v) => v !== null);
  if (body.errors?.length && complete && res.ok) {
    console.warn('Suwayomi reported field errors:', body.errors.map((e) => e.message).join('\n'));
    return body.data as T;
  }

  if (body.errors?.length) {
    const details = body.errors.map((e) => e.message).join('\n');
    if (/unauthori[sz]ed|forbidden/i.test(details)) throw new ServerError('auth', details);
    throw new ServerError(SCHEMA_MISMATCH.test(details) ? 'version' : 'server', details);
  }
  if (!res.ok || body.data === undefined) throw new ServerError('server', `HTTP ${res.status}`);
  return body.data;
}
