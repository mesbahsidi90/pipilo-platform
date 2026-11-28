export function readRoute({ pathname, search, hash }) {
  const params = new URLSearchParams(search);
  if (params.get('setup') === '1') return ['account', ''];
  const fragment = hash.slice(1);
  const route = fragment && !fragment.includes('=') ? fragment : pathname.replace(/^\/+|\/+$/g, '');
  const [page, detail = ''] = route.split('/');
  return [
    page === 'forgot-password' ? 'reset' : page === 'reset-password' ? 'account' : page || 'home',
    detail,
  ];
}

export function dashboardDestination(search) {
  const next = new URLSearchParams(search).get('next');
  return /^\/dashboard(?:\/(?:codes|kitchen|customer-screen)(?:\?branch=[a-f0-9-]{36})?)?$/i.test(
    next || '',
  )
    ? next
    : '/dashboard';
}

// Where the installed app (home-screen icon) opens: the dashboard for a
// signed-in shop, else the customer's last order, else the follow page.
export function standaloneStart({ signedIn, ticket, ticketRoute }) {
  if (signedIn) return ['dashboard', ''];
  if (ticket) return [ticketRoute === 'demo' ? 'demo' : 'track', ticket];
  return ['follow', ''];
}

// A Supabase sign-in is stored under sb-<project>-auth-token.
export function hasStoredSession(...stores) {
  for (const store of stores) {
    try {
      for (let i = 0; i < store.length; i++)
        if (/^sb-.+-auth-token$/.test(store.key(i) || '') && store.getItem(store.key(i)))
          return true;
    } catch {
      // Storage blocked: treat as signed out.
    }
  }
  return false;
}
