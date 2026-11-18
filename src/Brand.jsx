import { t as bippoT } from "./i18n.js";
import React from 'react';
import './brand-logo.css';
// Shared platform identity. Merchant logos are independent of this mark.
export default function Brand({
  linked = true
}) {
  const content = <><span className="brand-mark brand-image" aria-hidden="true">
    <img src="/icon-192.png" alt="" />
  </span><b>Bipilo</b></>;
  return linked ? <a href="/" className="brand" aria-label={bippoT("Bipilo — الرئيسية")}>{content}</a> : <span className="brand" aria-label="Bipilo">{content}</span>;
}
