import { t as bippoT, locale } from './i18n.js';
import React from 'react';
import { Smartphone } from 'lucide-react';
import { formatPrice } from './menuRules';

// Staff view of an order sent from the phone: where it goes and what's in it.
export default function OnlineOrderInfo({ order, currency = 'DZD' }) {
  if (!order.order_mode) return null;
  const d = order.order_details || {};
  const where =
    order.order_mode === 'table'
      ? bippoT('طاولة {0}', [d.table])
      : order.order_mode === 'car'
        ? bippoT('طوموبيل {0}', [[d.plate, d.color].filter(Boolean).join(' · ')])
        : bippoT('استلام من المحل');
  return (
    <div className="merchant-online">
      <b>
        <Smartphone size={14} aria-hidden="true" /> {bippoT('من التليفون')} · {where}
        {!order.accepted_at && order.status === 'preparing' && ' · ' + bippoT('يستنّى القبول')}
      </b>
      {(d.items || []).length > 0 && (
        <ul>
          {d.items.map((item, i) => (
            <li key={i}>
              {item.qty} × {item.name}
            </li>
          ))}
        </ul>
      )}
      {d.note && <span>{d.note}</span>}
      {Number(d.total) > 0 && (
        <span>
          {bippoT('المجموع')}: {formatPrice(d.total, currency, locale)}
        </span>
      )}
    </div>
  );
}
