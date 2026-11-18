import React from 'react';
import { t, locale } from './i18n.js';
import { duration, localDate } from './reporting';

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const heatColors = ['#f2f1ed', '#fde0db', '#ffb7aa', '#fb8373', '#e94b3a', '#af2318'];

function DailyOrders({ days, period, zone }) {
  const dayLength = 86400000;
  const first = Date.parse(localDate(period.from, zone));
  const last = Date.parse(localDate(Date.parse(period.to) - 1, zone));
  const counts = new Map(days.map(({ day, count }) => [day, count]));
  const dates = Array.from({ length: Math.round((last - first) / dayLength) + 1 }, (_, index) =>
    new Date(first + index * dayLength).toISOString().slice(0, 10),
  );
  const max = Math.max(1, ...counts.values());
  const points = dates.map((day, index) => ({
    day,
    count: counts.get(day) || 0,
    x: dates.length === 1 ? 400 : (index / (dates.length - 1)) * 800,
    y: 144 * (1 - (counts.get(day) || 0) / max),
  }));

  return (
    <div className="analytics-daily" dir="ltr">
      <div className="analytics-axis" aria-hidden="true">
        <span>{max}</span>
        <span>0</span>
      </div>
      <div>
        <svg
          viewBox="0 0 800 144"
          preserveAspectRatio="none"
          role="img"
          aria-label={t('الطلبات حسب اليوم')}
        >
          <path d="M0 .5H800M0 143.5H800" className="analytics-gridline" />
          {days.length > 0 && (
            <polyline
              className="analytics-series"
              points={points.map(({ x, y }) => [x, y].join(',')).join(' ')}
            />
          )}
          {points
            .filter(({ count }) => count > 0)
            .map(({ day, count, x, y }) => (
              <circle key={day} cx={x} cy={y} r="3" className="analytics-dot">
                <title>
                  {day} · {count}
                </title>
              </circle>
            ))}
        </svg>
        <div className="analytics-dates">
          <span>{dates[0].slice(5)}</span>
          <span>{dates.at(-1).slice(5)}</span>
        </div>
      </div>
    </div>
  );
}

function PeakHours({ activity }) {
  const max = Math.max(1, ...activity.flat());
  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  return (
    <>
      <div className="analytics-heat-scroll">
        <table className="analytics-heat" dir="ltr" aria-label={t('ساعات الذروة')}>
          <thead>
            <tr>
              <td />
              {hours.map((hour) => (
                <th scope="col" key={hour} aria-label={hour + ':00'}>
                  {hour % 3 === 0 ? hour : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activity.map((counts, day) => {
              const name = dayFormat.format(Date.UTC(2024, 0, 7 + day));
              return (
                <tr key={day}>
                  <th scope="row">{name}</th>
                  {counts.map((count, hour) => (
                    <td
                      key={hour}
                      title={name + ' · ' + hour + ':00 · ' + count}
                      aria-label={String(count)}
                      style={{
                        backgroundColor:
                          heatColors[Math.ceil((count / max) * (heatColors.length - 1))],
                      }}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="analytics-legend" dir="ltr">
        <span>0</span>
        {heatColors.map((color) => (
          <i key={color} style={{ background: color }} />
        ))}
        <span>{max}</span>
      </div>
    </>
  );
}

export default function ReportCharts({ report, period, zone, clinic }) {
  const maxPrep = Math.max(1, ...report.prepByHour);
  return (
    <div className="analytics-charts">
      <article className="panel">
        <h3>{t('الطلبات يوميًا')}</h3>
        <DailyOrders days={report.days} period={period} zone={zone} />
      </article>
      <article className="panel">
        <h3>{t('التقييمات')}</h3>
        <p className="analytics-empty">{t('بيانات تقييمات الزبائن غير متاحة حاليًا.')}</p>
      </article>
      <article className="panel">
        <h3>{t('ساعات الذروة')}</h3>
        <PeakHours activity={report.activity} />
      </article>
      <div className="analytics-pair">
        <article className="panel">
          <h3>{t(clinic ? 'وقت الانتظار حسب الساعة' : 'وقت التحضير حسب الساعة')}</h3>
          <div className="analytics-hourly" dir="ltr">
            {report.prepByHour.map((seconds, hour) => (
              <div key={hour} title={hour + ':00 · ' + duration(seconds)}>
                <i
                  style={{
                    height: seconds === null ? 0 : Math.max(3, (seconds / maxPrep) * 100) + '%',
                  }}
                />
                <span>{hour % 3 === 0 ? hour : ''}</span>
              </div>
            ))}
          </div>
          {report.prepByHour.every((seconds) => seconds === null) && (
            <p className="analytics-empty">{t('مازال ما كاش أوقات تحضير مسجّلة.')}</p>
          )}
        </article>
        <article className="panel">
          <h3>{t('طريقة التنبيه')}</h3>
          <p className="analytics-empty">{t('بيانات طرق التنبيه غير متاحة حاليًا.')}</p>
        </article>
      </div>
    </div>
  );
}
