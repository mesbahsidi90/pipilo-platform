import test from 'node:test';
import assert from 'node:assert/strict';
import {
  change,
  parseMenuText,
  readQuestion,
  summarizeFeedback,
  todaySummary,
} from '../src/assistantInsights.js';

test('reads what the owner asks, in dialect, Arabic or French', () => {
  assert.equal(readQuestion('كيف اليوم؟').intent, 'today');
  assert.equal(readQuestion('واش صرا ليوم').intent, 'today');
  assert.equal(readQuestion("Comment s'est passée la journée ?").intent, 'today');
  assert.equal(readQuestion('هذا الأسبوع').intent, 'week');
  assert.equal(readQuestion('وقتاش كانت الزحمة؟').intent, 'peak');
  assert.equal(readQuestion('ركّب المنيو').intent, 'menu_text');
  assert.equal(readQuestion('زيد خدّام').intent, 'staff');
  assert.equal(readQuestion('Ajouter un employé').intent, 'staff');
  assert.equal(readQuestion('حط رابط قوقل').intent, 'google');
  assert.equal(readQuestion('وقّف الأرقام').intent, 'pause');
  assert.equal(readQuestion('عاود افتح الأرقام').intent, 'resume');
  assert.equal(readQuestion('blabla').intent, null);
  assert.equal(readQuestion('   ').intent, null);
});

test('switching a feature on or off names the feature and the direction', () => {
  assert.deepEqual(readQuestion('شغّل بطاقة الولاء'), {
    intent: 'toggle',
    feature: 'loyalty',
    on: true,
  });
  assert.deepEqual(readQuestion('وقّف اللعبة'), { intent: 'toggle', feature: 'game', on: false });
  assert.deepEqual(readQuestion('فعّل الطلب من التيليفون'), {
    intent: 'toggle',
    feature: 'ordering',
    on: true,
  });
  assert.deepEqual(readQuestion('Désactiver le menu'), {
    intent: 'toggle',
    feature: 'menu',
    on: false,
  });
  // Building the menu is not switching it on, and the queue pause is its own action.
  assert.equal(readQuestion('ركّب المنيو').intent, 'menu_text');
  assert.equal(readQuestion('وقّف الأرقام').intent, 'pause');
});

test('today is compared with the same hours of yesterday and last week', () => {
  const now = Date.parse('2026-11-20T11:00:00Z'); // 12:00 in Algiers
  const at = (iso, extra = {}) => ({ created_at: iso, ...extra });
  const rows = [
    at('2026-11-20T08:00:00Z', { ready_at: '2026-11-20T08:05:00Z', status: 'collected' }),
    at('2026-11-20T09:10:00Z', { ready_at: '2026-11-20T09:13:00Z', status: 'collected' }),
    at('2026-11-20T09:40:00Z', { status: 'preparing' }),
    at('2026-11-19T08:30:00Z', { status: 'collected' }),
    at('2026-11-19T15:00:00Z', { status: 'collected' }), // after 12:00: not counted
    at('2026-11-13T09:00:00Z', { status: 'collected' }),
  ];
  const summary = todaySummary(rows, now);
  assert.equal(summary.today.count, 3);
  assert.equal(summary.today.avgPrep, 240);
  assert.equal(summary.yesterday.count, 1);
  assert.equal(summary.lastWeek.count, 1);
  assert.equal(summary.waiting, 1);
  assert.deepEqual(summary.peak, { hour: 10, count: 2 });
  assert.equal(change(3, 1), 200);
  assert.equal(change(3, 0), null);
});

test('a pasted menu becomes sections and priced items', () => {
  const { sections, skipped } = parseMenuText(
    `مشروبات:
قهوة 80
- كابتشينو : 150 دج
Thé à la menthe - 100 DA
شاي بالنعناع ١٢٠
Sandwichs
Poulet 1 200,00
هذا سطر غريب 12 و 13 فيه`,
  );
  assert.deepEqual(
    sections.map((section) => [section.name, section.items.map((i) => [i.name, i.price])]),
    [
      [
        'مشروبات',
        [
          ['قهوة', 80],
          ['كابتشينو', 150],
          ['Thé à la menthe', 100],
          ['شاي بالنعناع', 120],
        ],
      ],
      ['Sandwichs', [['Poulet', 1200]]],
    ],
  );
  assert.equal(skipped.length, 1);
});

test('a lone line without a price is reported, not lost', () => {
  const { sections, skipped } = parseMenuText('قهوة 80\nشاي');
  assert.equal(sections[0].items.length, 1);
  assert.deepEqual(skipped, ['شاي']);
});

test('items without a section go under a default one', () => {
  const { sections } = parseMenuText('قهوة 80\nشاي 60', 'المنيو');
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, 'المنيو');
  assert.equal(sections[0].items.length, 2);
});

test('feedback topics are still counted', () => {
  const topics = summarizeFeedback([{ comment: 'الانتظار طويل' }, { comment: 'service lent' }]);
  assert.equal(topics[0].topic, 'wait');
  assert.equal(topics[0].count, 2);
});
