import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementBody, cleanAnnouncement, isLive } from '../src/announcementRules.js';

const now = Date.parse('2026-11-20T12:00:00Z');

test('the admin form is cleaned before posting', () => {
  const { value } = cleanAnnouncement(
    { body_ar: '  ميزة جديدة ', body_fr: ' ', tone: 'odd', audience: 'free', link: '' },
    now,
  );
  assert.deepEqual(value, {
    body_ar: 'ميزة جديدة',
    body_fr: null,
    link: null,
    ends_at: null,
    tone: 'info',
    audience: 'free',
  });
});

test('bad announcements are refused with a reason', () => {
  assert.ok(cleanAnnouncement({ body_ar: '   ' }, now).error);
  assert.ok(cleanAnnouncement({ body_ar: 'x'.repeat(401) }, now).error);
  assert.ok(cleanAnnouncement({ body_ar: 'x', link: 'http://a.b' }, now).error);
  assert.ok(cleanAnnouncement({ body_ar: 'x', link: 'javascript:alert(1)' }, now).error);
  assert.ok(cleanAnnouncement({ body_ar: 'x', ends_on: '2026-11-19' }, now).error);
  assert.ok(cleanAnnouncement({ body_ar: 'x', ends_on: '2026-11-21' }, now).value.ends_at);
});

test('shops read their language when the admin wrote it', () => {
  const item = { body_ar: 'عربي', body_fr: 'Français' };
  assert.equal(announcementBody(item, 'fr'), 'Français');
  assert.equal(announcementBody(item, 'ar'), 'عربي');
  assert.equal(announcementBody({ body_ar: 'عربي' }, 'fr'), 'عربي');
});

test('an announcement stops after its end date or when ended', () => {
  assert.equal(isLive({}, now), true);
  assert.equal(isLive({ ends_at: '2026-11-21T00:00:00Z' }, now), true);
  assert.equal(isLive({ ends_at: '2026-11-19T00:00:00Z' }, now), false);
  assert.equal(isLive({ ended_at: '2026-11-20T10:00:00Z' }, now), false);
});
