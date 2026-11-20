// Legacy fields support installed workers; Safari can display the declarative
// notification even if its service worker cannot run.
export function orderPayload(order, route = 'track', language, settings, siteOrigin) {
  const french = language === 'fr';
  const lang = french ? 'fr' : 'ar';
  const vars = {
    number: String(order.number),
    venue: settings?.name || (french ? 'le comptoir' : 'الكونتوار'),
    room: order.room || '',
  };
  const copy = settings?.alert_copy;
  function field(key, fallback, limit) {
    const template = copy?.[lang + '_' + key];
    const clean =
      typeof template === 'string' ? template.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
    return (clean || fallback)
      .replace(/\{(number|venue|room)\}/g, (_, name) => vars[name])
      .slice(0, limit);
  }
  const clinic = (route === 'track' || route === 'trial') && order.shops?.kind === 'clinic';
  const title = field(
    'title',
    clinic
      ? french
        ? 'C’est votre tour !'
        : 'جا دورك!'
      : french
        ? 'Votre commande est prête !'
        : 'طلبك راه واجد!',
    100,
  );
  const body = field(
    'body',
    clinic
      ? french
        ? order.room
          ? 'Ticket {number} · Allez à : {room}.'
          : 'Ticket {number} · Présentez-vous à l’accueil.'
        : order.room
          ? 'رقم الدور {number} · توجّه لـ {room}.'
          : 'رقم الدور {number} · توجّه للاستقبال.'
      : french
        ? 'Commande {number} · Retirez-la au comptoir.'
        : 'الطلب {number} واجد. تقدر تجي تديه من الكونتوار.',
    210,
  );
  const origin = [
    'https://bipilo.app',
    'https://www.bipilo.app',
    'https://bipilo-platform.pages.dev',
    'https://bippo-platform.pages.dev',
    'http://localhost:5189',
    'http://127.0.0.1:5189',
  ].includes(siteOrigin)
    ? siteOrigin
    : 'https://bippo-platform.pages.dev';
  const url = `${origin}/${french ? '?lang=fr' : ''}#${route}/${order.token}`;
  return {
    type: 'ORDER_READY',
    title,
    body,
    url,
    ticket: order.token,
    web_push: 8030,
    ...(language ? { language: lang } : {}),
    notification: {
      title,
      body,
      navigate: url,
      lang: lang + '-DZ',
      dir: french ? 'ltr' : 'rtl',
      silent: false,
      tag: 'order-' + order.token,
      renotify: true,
      requireInteraction: true,
      icon: origin + '/icon-192.png',
      vibrate: [250, 100, 250, 100, 500],
      data: { url },
    },
  };
}

// «قرب دورك»: a softer reminder while the patient still waits.
export function nearPayload(order, language, siteOrigin) {
  const french = language === 'fr';
  const lang = french ? 'fr' : 'ar';
  const base = orderPayload(order, 'track', language, null, siteOrigin);
  const title = french ? 'Votre tour approche !' : 'قرب دورك!';
  const body = french
    ? `Ticket ${order.number} · Rapprochez-vous de l’accueil.`
    : `رقم الدور ${order.number} · قرّب للاستقبال.`;
  return {
    ...base,
    type: 'QUEUE_NEAR',
    title,
    body,
    notification: {
      ...base.notification,
      title,
      body,
      lang: lang + '-DZ',
      tag: 'near-' + order.token,
      requireInteraction: false,
      vibrate: [200, 100, 200],
    },
  };
}
