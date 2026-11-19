// Maps an HTTP request of the POS API to a database action.
// Path is what follows the function name, e.g. /v1/tickets/INV-1/ready.
export function route(method, path) {
  const parts = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);
  if (parts[0] === 'api') parts.shift();
  if (parts[0] !== 'v1') return null;
  const [, resource, rawTicket, verb, extra] = parts;
  if (extra !== undefined) return null;
  if (resource === 'branches' && rawTicket === undefined)
    return method === 'GET' ? { action: 'branches' } : { error: 405 };
  if (resource !== 'tickets') return null;
  if (rawTicket === undefined) return method === 'POST' ? { action: 'create' } : { error: 405 };
  let ticket;
  try {
    ticket = decodeURIComponent(rawTicket);
  } catch {
    return null;
  }
  if (!ticket || ticket.length > 128) return null;
  if (verb === undefined) return method === 'GET' ? { action: 'get', ticket } : { error: 405 };
  if (!['ready', 'complete', 'cancel'].includes(verb)) return null;
  return method === 'POST' ? { action: verb, ticket } : { error: 405 };
}

export function bearer(header) {
  const match = /^Bearer\s+(\S+)$/i.exec(header || '');
  return match ? match[1] : '';
}
