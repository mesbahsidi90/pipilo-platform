import { cloud, db } from './store';
import { parseVisit } from './signupSourceRules';

const visitKey = 'bipilo-visit';
const maxAge = 60 * 86400000;

// Remember the last tracked link this browser arrived with (kept 60 days).
export function captureVisit() {
  try {
    const visit = parseVisit(location.search, location.pathname);
    if (visit) localStorage.setItem(visitKey, JSON.stringify({ ...visit, at: Date.now() }));
  } catch {
    // Tracking is best effort.
  }
}

export function savedVisit() {
  try {
    const visit = JSON.parse(localStorage.getItem(visitKey) || 'null');
    return visit && Date.now() - visit.at < maxAge ? visit : null;
  } catch {
    return null;
  }
}

// Saves where the new shop came from. Never blocks the signup.
export async function recordSignupSource(answer) {
  const visit = savedVisit() || {};
  try {
    if (!cloud) {
      localStorage.setItem('bipilo-demo-source', JSON.stringify({ answer, ...visit }));
      return;
    }
    await db.rpc('record_signup_source', {
      answer: answer || null,
      ref: visit.ref || null,
      utm_source: visit.utm_source || null,
      utm_medium: visit.utm_medium || null,
      utm_campaign: visit.utm_campaign || null,
      landing: visit.landing || null,
      invite: visit.invite || null,
    });
  } catch {
    // Tracking is best effort.
  }
}
