// One stacking game, dressed for each activity: tap to drop a piece on the
// one below; the part that hangs over is cut. Texts are Arabic keys (t()).

const food = (kind) => ['restaurant', 'food_court'].includes(kind);

export const gameThemes = {
  coffee: {
    title: 'طلّع قهوتك',
    brand: 'وقت القهوة',
    kicker: 'ضغطة. طبقة. قهوة أطول.',
    intro: 'هبّط الطبقة فوق اللي تحتها. ركّز وطلّع أعلى كوب!',
    drop: 'هبّط الطبقة',
    unit: 'طبقاتك',
    over: 'طلّعت {0} طبقات. تقدر تطلّع أكثر؟',
    base: 'cup',
    layer: 'flat',
    colors: [
      ['#bb7843', '#d39a60'],
      ['#e4c99b', '#f7dfb4'],
      ['#8fb9a1', '#bedfc3'],
      ['#5b8f78', '#91b69b'],
    ],
    sky: ['#f8fbf2', '#e3eee0'],
  },
  sandwich: {
    title: 'ركّب الساندويتش',
    brand: 'وقت الماكلة',
    kicker: 'ضغطة. حشوة. ساندويتش أطول.',
    intro: 'هبّط كل حشوة فوق اللي تحتها. ركّز وركّب أطول ساندويتش!',
    drop: 'هبّط الحشوة',
    unit: 'حشواتك',
    over: 'ركّبت {0} حشوات. تقدر تزيد؟',
    base: 'plate',
    layer: 'flat',
    colors: [
      ['#7fb069', '#a8d08d'],
      ['#e9b949', '#f6d77a'],
      ['#d9584a', '#ee8577'],
      ['#8a4b2f', '#b06d4c'],
      ['#d8a15a', '#efc68b'],
    ],
    sky: ['#fff8ef', '#f5e6d3'],
  },
  laundry: {
    title: 'طبّق الحوايج',
    brand: 'وقت الغسيل',
    kicker: 'ضغطة. قطعة. كومة أعلى.',
    intro: 'هبّط كل قطعة مطويّة فوق اللي تحتها. ركّز وطبّق أعلى كومة!',
    drop: 'هبّط القطعة',
    unit: 'قطعك',
    over: 'طبّقت {0} قطع. تقدر تزيد؟',
    base: 'basket',
    layer: 'flat',
    colors: [
      ['#7aa7d9', '#a9c8ec'],
      ['#f2f2ee', '#ffffff'],
      ['#e7a1b0', '#f4c6d0'],
      ['#9fd3c7', '#c7e9e1'],
    ],
    sky: ['#f2f7fd', '#dde9f5'],
  },
  tires: {
    title: 'ركّب العجلات',
    brand: 'وقت الغسيل',
    kicker: 'ضغطة. عجلة. صفّ أعلى.',
    intro: 'هبّط كل عجلة فوق اللي تحتها. ركّز وركّب أعلى صفّ!',
    drop: 'هبّط العجلة',
    unit: 'عجلاتك',
    over: 'ركّبت {0} عجلات. تقدر تزيد؟',
    base: 'ground',
    layer: 'tire',
    colors: [
      ['#2b2f33', '#4a5056'],
      ['#33383d', '#555c63'],
    ],
    sky: ['#eef5f8', '#d6e4ea'],
  },
  fabric: {
    title: 'ركّب القماش',
    brand: 'وقت الخياطة',
    kicker: 'ضغطة. ثوب. كومة أعلى.',
    intro: 'هبّط كل ثوب قماش فوق اللي تحتو. ركّز وركّب أعلى كومة!',
    drop: 'هبّط الثوب',
    unit: 'أثوابك',
    over: 'ركّبت {0} أثواب. تقدر تزيد؟',
    base: 'table',
    layer: 'flat',
    colors: [
      ['#9b5de5', '#bf94f0'],
      ['#f15bb5', '#f78fcd'],
      ['#00a6a6', '#4cc9c9'],
      ['#fee440', '#fff07a'],
    ],
    sky: ['#fbf6fd', '#efe4f5'],
  },
  blocks: {
    title: 'ابني البرج',
    brand: 'وقت الانتظار',
    kicker: 'ضغطة. مكعّب. برج أعلى.',
    intro: 'هبّط كل مكعّب فوق اللي تحتو. ركّز وابني أعلى برج!',
    drop: 'هبّط المكعّب',
    unit: 'مكعّباتك',
    over: 'بنيت {0} مكعّبات. تقدر تزيد؟',
    base: 'ground',
    layer: 'flat',
    colors: [
      ['#ef476f', '#f47c99'],
      ['#ffd166', '#ffe09a'],
      ['#06d6a0', '#5ce6c0'],
      ['#118ab2', '#4fb0d1'],
    ],
    sky: ['#f7f9fb', '#e3e9ef'],
  },
};

// Which game a shop's customers see (clinics have none).
export function gameFor(kind) {
  if (kind === 'clinic') return null;
  if (kind === 'cafe' || !kind) return 'coffee';
  if (food(kind)) return 'sandwich';
  if (kind === 'laundry') return 'laundry';
  if (kind === 'car_wash') return 'tires';
  if (kind === 'tailor') return 'fabric';
  return 'blocks';
}
