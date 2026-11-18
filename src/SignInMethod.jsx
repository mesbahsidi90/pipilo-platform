import { t as bippoT } from './i18n.js';
import React from 'react';
import { Mail, MessageCircle } from 'lucide-react';

export default function SignInMethod({ value, onChange }) {
  const options = [
    ['whatsapp', MessageCircle, bippoT('واتساب')],
    ['email', Mail, bippoT('البريد الإلكتروني')],
  ];
  return (
    <div className="signin-method" role="radiogroup" aria-label={bippoT('طريقة الدخول')}>
      {options.map(([key, Icon, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={value === key ? 'active' : ''}
          onClick={() => onChange(key)}
        >
          <Icon size={17} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
