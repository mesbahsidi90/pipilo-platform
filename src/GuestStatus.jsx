import { t as bippoT } from './i18n.js';
import React from 'react';
import { Radio, Check, CheckCheck, Footprints, Eye, Smartphone, BellOff } from 'lucide-react';
import { guestStage, guestActivity, guestSteps } from './guestExperience';

const stepIcons = {
  sent: Check,
  delivered: CheckCheck,
  seen: Eye,
  coming: Footprints,
  nopush: BellOff,
};
export default function GuestStatus({ order, unavailable = false }) {
  if (unavailable)
    return <small className="guest-state waiting">{bippoT('حالة اتصال الزبون غير متاحة')}</small>;
  const steps = guestSteps(order);
  if (steps.length)
    return (
      <div className="guest-status">
        <ol className="guest-steps" aria-label={bippoT('حالة النداء')}>
          {steps.map(({ key, label, done, warn }) => {
            const Icon = stepIcons[key];
            return (
              <li key={key} className={done ? 'done' : warn ? 'warn' : ''}>
                <Icon size={13} aria-hidden="true" />
                {label}
              </li>
            );
          })}
        </ol>
        {order.guest?.last_seen_at && <small>{guestActivity(order.guest)}</small>}
        {!order.guest?.push_enabled_at &&
          !order.guest?.ready_seen_at &&
          !order.guest?.coming_at && (
            <small className="guest-alert-hint">
              {bippoT('إشعار الخلفية غير مؤكّد؛ ناديلو إذا لزم.')}
            </small>
          )}
      </div>
    );
  const stage = guestStage(order),
    Icon =
      stage.tone === 'coming'
        ? Footprints
        : stage.tone === 'seen'
          ? Eye
          : stage.tone === 'done'
            ? CheckCheck
            : stage.tone === 'enabled'
              ? Smartphone
              : Radio;
  return (
    <div className="guest-status">
      <span className={'guest-state ' + stage.tone}>
        <Icon size={13} />
        {stage.label}
      </span>
      {order.guest?.last_seen_at && <small>{guestActivity(order.guest)}</small>}
      {order.status !== 'collected' &&
        !order.guest?.push_enabled_at &&
        !order.guest?.ready_seen_at &&
        !order.guest?.coming_at && (
          <small className="guest-alert-hint">
            {bippoT('إشعار الخلفية غير مؤكّد؛ ناديلو إذا لزم.')}
          </small>
        )}
    </div>
  );
}
