import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { language } from './i18n';
import './developer-docs.css';

const fr = language === 'fr';
const copy = (ar, french) => fr ? french : ar;
const specUrl = `${import.meta.env.BASE_URL}openapi/pos-v1.json`;

export default function DeveloperDocs() {
  const [spec, setSpec] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    fetch(specUrl, { signal: request.signal }).then(response => {
      if (!response.ok) throw new Error('OpenAPI unavailable');
      return response.json();
    }).then(setSpec).catch(error => {
      if (error.name !== 'AbortError') setFailed(true);
    });
    return () => request.abort();
  }, []);

  return <section className="wrap developer-docs">
    <div className="public-note">
      <p>{copy('هذه مسودة للتكامل مع الكاشير. العمليات أدناه مقترحة، والوصول للواجهة مازال غير متاح.', 'Ce document présente le projet d’intégration caisse. Les opérations ci-dessous sont proposées et l’API n’est pas encore accessible.')}</p>
      <a href={specUrl} download><Download size={18} /> OpenAPI JSON</a>
    </div>
    <div className="developer-card">
      <h2>{copy('من الكاشير حتى هاتف الزبون', 'De la caisse au téléphone du client')}</h2>
      <ol>
        <li>{copy('الكاشير ينشئ تيكي بكود الفرع ونمرة الطلب ومرجعه في الكاشير.', 'La caisse crée un ticket avec le code de la succursale, le numéro de commande et sa référence interne.')}</li>
        <li>{copy('يحفظ معرّف التيكي، ويحوّل رابط المتابعة إلى QR يطبعو على الفاتورة. الزبون يتبع طلبو بلا حساب.', 'Elle conserve l’identifiant du ticket et imprime un QR à partir du lien de suivi. Le client suit sa commande sans compte.')}</li>
        <li>{copy('كي يوجد الطلب، الكاشير أو المطبخ يرسل معرّف التيكي لتحديث الحالة.', 'Quand la commande est prête, la caisse ou la cuisine envoie l’identifiant du ticket pour mettre à jour son statut.')}</li>
      </ol>
      <p>{copy('التصميم المقترح يستعمل مفتاح وصول خاص بكل نشاط. المفتاح يبقى في خادم التكامل، ورابط المتابعة وحده هو اللي يوصل للزبون.', 'Le projet prévoit une clé d’accès par établissement, conservée côté serveur. Seul le lien de suivi est communiqué au client.')}</p>
    </div>
    <h2>{copy('عمليات الواجهة المقترحة', 'Opérations proposées')}</h2>
    {!spec && <p role="status">{failed ? copy('تعذّر عرض العمليات. تقدر تفتح ملف OpenAPI من الرابط أعلاه.', 'Impossible d’afficher les opérations. Le fichier OpenAPI reste accessible via le lien ci-dessus.') : copy('جارٍ تحميل التوثيق…', 'Chargement de la documentation…')}</p>}
    {spec && Object.entries(spec.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => {
      const example = operation.requestBody?.content['application/json'].example;
      return <details key={method + path} className="developer-card developer-operation">
        <summary><span>{fr ? operation.summary : operation['x-summary-ar']}</span><code dir="ltr"><b>{method.toUpperCase()}</b> {path}</code></summary>
        {example && <><h3>{copy('مثال على الطلب', 'Exemple de requête')}</h3><pre dir="ltr">{JSON.stringify(example, null, 2)}</pre></>}
        <h3>{copy('مثال على الرد', 'Exemple de réponse')}</h3>
        <pre dir="ltr">{JSON.stringify(Object.values(operation.responses)[0].content['application/json'].example, null, 2)}</pre>
      </details>;
    }))}
  </section>;
}
