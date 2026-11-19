import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { language } from './i18n';
import './developer-docs.css';

const fr = language === 'fr';
const copy = (ar, french) => (fr ? french : ar);
const specUrl = `${import.meta.env.BASE_URL}openapi/pos-v1.json`;
const api = 'https://kdvtqlqiervznhzbpjcx.supabase.co/functions/v1/pos-api/v1';
const example = [
  `curl -X POST ${api}/tickets \\`,
  '  -H "Authorization: Bearer bpk_…" \\',
  '  -H "Content-Type: application/json" \\',
  `  -d '{"externalRef":"INV-2026-000123","number":"42"}'`,
  '',
  `curl -X POST ${api}/tickets/INV-2026-000123/ready \\`,
  '  -H "Authorization: Bearer bpk_…"',
].join('\n');

export default function DeveloperDocs() {
  const [spec, setSpec] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    fetch(specUrl, { signal: request.signal })
      .then((response) => {
        if (!response.ok) throw new Error('OpenAPI unavailable');
        return response.json();
      })
      .then(setSpec)
      .catch((error) => {
        if (error.name !== 'AbortError') setFailed(true);
      });
    return () => request.abort();
  }, []);

  return (
    <section className="wrap developer-docs">
      <div className="public-note">
        <p>
          {copy(
            'واجهة الربط مع الكاشير متاحة في الباقة الاحترافية. صاحب المحل ينشئ مفتاح الفرع من «المزايا» ← «الربط مع الكاشير».',
            'L’API caisse est disponible avec l’offre Pro. Le gérant crée la clé de la succursale dans « Fonctionnalités » → « Liaison caisse ».',
          )}
        </p>
        <a href={specUrl} download>
          <Download size={18} /> OpenAPI JSON
        </a>
      </div>
      <div className="developer-card">
        <h2>{copy('من الكاشير حتى هاتف الزبون', 'De la caisse au téléphone du client')}</h2>
        <ol>
          <li>
            {copy(
              'كي يتسجّل الطلب، الكاشير يبعث ⁦POST /tickets⁩ بمرجع الفاتورة (⁦externalRef⁩)، ونمرة الطلب إذا حب.',
              'À l’enregistrement, la caisse envoie POST /tickets avec la référence du ticket de caisse (externalRef) et, si besoin, le numéro.',
            )}
          </li>
          <li>
            {copy(
              'الرد فيه ⁦trackingUrl⁩: الكاشير يطبعو QR على التيكي. الزبون يمسحو ويفعّل التنبيه بلا حساب.',
              'La réponse contient trackingUrl : la caisse l’imprime en QR sur le ticket. Le client le scanne et active l’alerte, sans compte.',
            )}
          </li>
          <li>
            {copy(
              'كي يوجد الطلب، الكاشير ولا المطبخ يبعث ⁦POST /tickets/{ticket}/ready⁩ وتليفون الزبون يصوني. من بعد ⁦complete⁩ كي يستلم، ولا ⁦cancel⁩.',
              'Quand la commande est prête, la caisse ou la cuisine envoie POST /tickets/{ticket}/ready et le téléphone du client sonne. Puis complete à la remise, ou cancel.',
            )}
          </li>
        </ol>
        <p>
          {copy(
            '⁦{ticket}⁩ هو معرّف Bipilo ولا مرجعك ⁦externalRef⁩، باش ما تحتاجش تحفظ معرّفنا. إذا عاودت نفس الطلب بنفس ⁦externalRef⁩ ترجعلك نفس التيكي، ما يتزادش تيكي ثاني.',
            '{ticket} est l’identifiant Bipilo ou votre externalRef : inutile de stocker notre identifiant. Renvoyer la même création avec le même externalRef renvoie le même ticket, sans doublon.',
          )}
        </p>
        <p>
          {copy(
            'المفتاح يبقى في خادم الكاشير: الطلبات اللي تجي من متصفح مرفوضة. الحد 120 طلب في الدقيقة لكل مفتاح.',
            'La clé reste sur le serveur de la caisse : les appels depuis un navigateur sont refusés. Limite : 120 appels par minute et par clé.',
          )}
        </p>
        <h3>{copy('مثال', 'Exemple')}</h3>
        <pre dir="ltr">{example}</pre>
      </div>
      <h2>{copy('عمليات الواجهة', 'Opérations')}</h2>
      {!spec && (
        <p role="status">
          {failed
            ? copy(
                'تعذّر عرض العمليات. تقدر تفتح ملف OpenAPI من الرابط أعلاه.',
                'Impossible d’afficher les opérations. Le fichier OpenAPI reste accessible via le lien ci-dessus.',
              )
            : copy('جارٍ تحميل التوثيق…', 'Chargement de la documentation…')}
        </p>
      )}
      {spec &&
        Object.entries(spec.paths).flatMap(([path, methods]) =>
          Object.entries(methods).map(([method, operation]) => {
            const example = operation.requestBody?.content['application/json'].example;
            return (
              <details key={method + path} className="developer-card developer-operation">
                <summary>
                  <span>{fr ? operation.summary : operation['x-summary-ar']}</span>
                  <code dir="ltr">
                    <b>{method.toUpperCase()}</b> {path}
                  </code>
                </summary>
                {example && (
                  <>
                    <h3>{copy('مثال على الطلب', 'Exemple de requête')}</h3>
                    <pre dir="ltr">{JSON.stringify(example, null, 2)}</pre>
                  </>
                )}
                <h3>{copy('مثال على الرد', 'Exemple de réponse')}</h3>
                <pre dir="ltr">
                  {JSON.stringify(
                    Object.values(operation.responses)[0].content['application/json'].example,
                    null,
                    2,
                  )}
                </pre>
              </details>
            );
          }),
        )}
    </section>
  );
}
