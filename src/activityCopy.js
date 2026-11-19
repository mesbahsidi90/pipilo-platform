// What the customer page says, in the words of each activity. Values are
// Arabic keys translated with t() where shown.

const food = {
  loading: 'نوجدو طلبك…',
  waiting: 'طلبك راه يتحضّر',
  waitingNote: 'ننبّهوك كي يوجد، اقعد مرتاح.',
  calling: 'طلبك راه واجد!',
  ready: 'طلبك واجد للاستلام',
  pickup: 'تقدر تجي تديه من الكونتوار.',
  finished: 'بالصحة والراحة!',
  cancelled: 'الطلب تلغى',
  cancelledNote: 'تواصل مع المحل إذا تحتاج مساعدة.',
  number: 'رقم الطلب',
};

const copies = {
  food,
  clinic: {
    ...food,
    loading: 'نوجدو دورك…',
    waiting: 'راك في الانتظار',
    waitingNote: 'ننبّهوك كي يجي دورك.',
    calling: 'جا دورك!',
    ready: 'جا دورك!',
    pickup: 'توجّه للاستقبال.',
    finished: 'انتهى دورك',
    cancelled: 'دورك تلغى',
    cancelledNote: 'إذا مازلت هنا، توجّه للاستقبال باش يرجّعوك للانتظار.',
    number: 'رقم الدور',
  },
  laundry: {
    ...food,
    loading: 'نوجدو تيكيك…',
    waiting: 'حوايجك راهم يتغسلو',
    waitingNote: 'ننبّهوك كي يوجدو، روح لشغلك مرتاح.',
    calling: 'حوايجك راهم واجدين!',
    ready: 'حوايجك واجدين للاستلام',
    pickup: 'تقدر تجي تديهم من الكونتوار.',
    finished: 'يعطيك الصحة!',
    cancelled: 'التيكي تلغى',
    number: 'رقم التيكي',
  },
  car_wash: {
    ...food,
    loading: 'نوجدو تيكيك…',
    waiting: 'طوموبيلك راهي تتغسل',
    waitingNote: 'ننبّهوك كي تكمل، اقعد مرتاح.',
    calling: 'طوموبيلك راهي واجدة!',
    ready: 'طوموبيلك واجدة للاستلام',
    pickup: 'تقدر تجي تديها.',
    finished: 'يعطيك الصحة!',
    cancelled: 'التيكي تلغى',
    number: 'رقم التيكي',
  },
  tailor: {
    ...food,
    loading: 'نوجدو تيكيك…',
    waiting: 'التعديل راه يتخدم',
    waitingNote: 'ننبّهوك كي يكمل، روح لشغلك مرتاح.',
    calling: 'التعديل راه واجد!',
    ready: 'التعديل واجد للاستلام',
    pickup: 'تقدر تجي تديه من الكونتوار.',
    finished: 'يعطيك الصحة!',
    cancelled: 'التيكي تلغى',
    number: 'رقم التيكي',
  },
  other: {
    ...food,
    loading: 'نوجدو تيكيك…',
    waiting: 'الخدمة تاعك راهي تتوجد',
    calling: 'جا دورك!',
    ready: 'واجد للاستلام',
    finished: 'يعطيك الصحة!',
    cancelled: 'التيكي تلغى',
    number: 'رقم التيكي',
  },
};

export function activityCopy(kind) {
  if (['cafe', 'restaurant', 'food_court'].includes(kind) || !kind) return copies.food;
  return copies[kind] || copies.other;
}

// Every pickup default, so a shop that never edited it gets its own wording.
export const defaultPickups = new Set(Object.values(copies).map((c) => c.pickup));
