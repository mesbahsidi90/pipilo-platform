import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guessAnswer,
  inviteCode,
  inviteLink,
  parseVisit,
  trackingLink,
} from '../src/signupSourceRules.js';

test('ad link parameters are read and cleaned', () => {
  assert.equal(parseVisit('?lang=ar'), null);
  assert.deepEqual(parseVisit('?ref=FB&utm_campaign=Ramadan%202027', '/signup'), {
    ref: 'fb',
    utm_source: null,
    utm_medium: null,
    utm_campaign: 'Ramadan 2027',
    invite: null,
    landing: '/signup',
  });
});

test('signup answer is guessed from the link', () => {
  assert.equal(guessAnswer(parseVisit('?ref=fb')), 'facebook');
  assert.equal(guessAnswer(parseVisit('?ref=tt-cafes')), 'tiktok');
  assert.equal(guessAnswer(parseVisit('?utm_source=instagram')), 'instagram');
  assert.equal(guessAnswer(parseVisit('?ref=visit_bab-ezzouar')), 'visit');
  assert.equal(guessAnswer(parseVisit('?ref=partner')), '');
  assert.equal(guessAnswer(null), '');
});

test('tracking links carry ref, utm and a clean campaign name', () => {
  const link = trackingLink('https://bipilo.app', 'facebook', ' Cafés Alger — Nov ');
  const url = new URL(link);
  assert.equal(url.searchParams.get('ref'), 'fb');
  assert.equal(url.searchParams.get('utm_source'), 'facebook');
  assert.equal(url.searchParams.get('utm_medium'), 'paid_social');
  assert.equal(url.searchParams.get('utm_campaign'), 'cafés-alger-nov');
  assert.equal(
    trackingLink('https://bipilo.app', 'visit', '', '/signup'),
    'https://bipilo.app/signup?ref=visit&utm_source=field&utm_medium=offline',
  );
  assert.equal(guessAnswer(parseVisit(url.search)), 'facebook');
});

test('invite links carry a clean referral code and count as a friend', () => {
  assert.equal(inviteCode(' AtJ5ZA '), 'atj5za');
  assert.equal(inviteCode('abc'), null);
  assert.equal(inviteCode('abc-123'), null);
  const link = inviteLink('https://bipilo.app', 'atj5za');
  assert.equal(link, 'https://bipilo.app/?invite=atj5za');
  const visit = parseVisit(new URL(link).search, '/');
  assert.equal(visit.invite, 'atj5za');
  assert.equal(guessAnswer(visit), 'friend');
  assert.equal(parseVisit('?invite=bad!'), null);
});
