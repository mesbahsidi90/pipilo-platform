export function readRoute({ pathname, search, hash }) {
  const params = new URLSearchParams(search);
  if (params.get('setup') === '1') return ['account', ''];
  const fragment = hash.slice(1);
  const route = fragment && !fragment.includes('=') ? fragment : pathname.replace(/^\/+|\/+$/g, '');
  const [page, detail = ''] = route.split('/');
  return [page === 'forgot-password' ? 'reset' : page === 'reset-password' ? 'account' : page || 'home', detail];
}

export function dashboardDestination(search) {
  const next = new URLSearchParams(search).get('next');
  return /^\/dashboard(?:\/(?:codes|kitchen|customer-screen)(?:\?branch=[a-f0-9-]{36})?)?$/i.test(next || '')
    ? next : '/dashboard';
}
