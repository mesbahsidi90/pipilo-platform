import { t } from './i18n.js';

export const shopTypes = {
  cafe: t('مقهى'),
  restaurant: t('مطعم'),
  food_court: t('فود كورت'),
  laundry: t('مغسلة ملابس'),
  car_wash: t('مغسلة سيارات'),
  tailor: t('خياط'),
  clinic: t('عيادة أو مركز'),
  other: t('نشاط آخر'),
};

const foodServiceKinds = new Set(['cafe', 'restaurant', 'food_court']);

export function shopActivity(kind) {
  const key = Object.hasOwn(shopTypes, kind) ? kind : 'cafe';
  const foodService = foodServiceKinds.has(key);
  return {
    label: shopTypes[key],
    foodService,
    clinic: key === 'clinic',
    // Menu and phone ordering only make sense where food is sold
    // («نشاط آخر» keeps them, it may be a bakery or a shop with a catalogue).
    menu: foodService || key === 'other',
    loyalty: key !== 'clinic',
    trackingMode: foodService ? 'order' : 'counter',
  };
}
