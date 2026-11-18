import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityDays,expired,needsOrderFollowup,operating} from '../src/adminDomain.js';
const now=Date.parse('2026-11-07T12:00:00Z');
test('subscription expiry includes exact deadline, respects future and indefinite terms',()=>{assert.equal(expired({period_end:'2026-11-07T12:00:00Z'},now),true);assert.equal(expired({period_end:'2026-11-07T12:00:01Z'},now),false);assert.equal(expired({period_end:null},now),false);});
test('only an active shop with a current active or trial subscription can operate',()=>{const shop={status:'active'};assert.equal(operating(shop,{status:'active'},now),true);assert.equal(operating(shop,{status:'trial'},now),true);for(const state of ['cancelled','past_due',undefined])assert.equal(operating(shop,{status:state},now),false);assert.equal(operating({status:'suspended'},{status:'active'},now),false);assert.equal(operating(shop,{status:'active',period_end:'2026-11-06'},now),false);assert.equal(operating(shop,undefined,now),false);});
test('order follow-up waits for three full Algerian days and skips unused or suspended shops', () => {
  const today = '2026-11-02';
  const shop = { status: 'active', last_order_at: '2026-10-29T22:59:59Z' };
  assert.deepEqual(activityDays(today, 4), ['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30']);
  assert.equal(needsOrderFollowup(shop, today), true);
  assert.equal(needsOrderFollowup({ ...shop, last_order_at: '2026-10-29T23:00:00Z' }, today), false);
  assert.equal(needsOrderFollowup({ ...shop, last_order_at: null }, today), false);
  assert.equal(needsOrderFollowup({ ...shop, status: 'suspended' }, today), false);
});
