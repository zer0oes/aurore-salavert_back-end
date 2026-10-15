import React, { useEffect, useState } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { Box, Typography, Button } from '@strapi/design-system';

const number = (value) => new Intl.NumberFormat('fr-FR').format(value);
const colors = ['#7c6cf2', '#20a7a0', '#e8973f'];
const shortDate = (date) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

function Timeline({ rows }) {
  const [hover, setHover] = useState(null);
  const [metric, setMetric] = useState(0);
  const labels = ['Utilisateurs actifs', 'Sessions', 'Pages vues'];
  const width = 900, height = 280, left = 46, right = 20, top = 20, bottom = 40;
  const max = Math.max(4, ...rows.map((row) => row.values[metric]));
  const ceiling = Math.ceil(max / 4) * 4;
  const x = (i) => left + i * (width - left - right) / Math.max(1, rows.length - 1);
  const y = (value) => height - bottom - value / ceiling * (height - top - bottom);
  const points = rows.map((row, i) => `${x(i)},${y(row.values[metric])}`).join(' ');
  const selected = hover === null ? null : rows[hover];
  return <Box padding={6} background="neutral0" hasRadius style={{ marginTop: 24 }}>
    <Typography tag="h2" variant="beta">Évolution de la fréquentation</Typography>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '20px 0' }}>
      {labels.map((label, i) => <Button key={label} variant={metric === i ? 'default' : 'tertiary'} onClick={() => { setMetric(i); setHover(null); }} aria-pressed={metric === i}>{label}</Button>)}
    </div>
    <Typography textColor="neutral600">{selected ? `${shortDate(selected.date)} : ${number(selected.values[metric])} ${labels[metric].toLowerCase()}` : 'Survolez la courbe ou sélectionnez un point pour consulter le détail.'}</Typography>
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block', marginTop: 16 }} role="img" aria-label={`${labels[metric]} par jour, du ${shortDate(rows[0].date)} au ${shortDate(rows[rows.length - 1].date)}`}>
      {[0, 1, 2, 3, 4].map((tick) => <g key={tick}>
        <line x1={left} x2={width - right} y1={y(tick * ceiling / 4)} y2={y(tick * ceiling / 4)} stroke="currentColor" opacity="0.12" />
        <text x={left - 12} y={y(tick * ceiling / 4) + 4} textAnchor="end" fill="currentColor" fontSize="12">{number(tick * ceiling / 4)}</text>
      </g>)}
      <polygon points={`${x(0)},${y(0)} ${points} ${x(rows.length - 1)},${y(0)}`} fill={colors[metric]} opacity="0.12" />
      <polyline points={points} fill="none" stroke={colors[metric]} strokeWidth="3" strokeLinejoin="round" />
      {rows.map((row, i) => <g key={row.date}>
        {(i === 0 || i === rows.length - 1 || i % Math.ceil(rows.length / 6) === 0) && <text x={x(i)} y={height - 10} textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'} fill="currentColor" fontSize="12">{shortDate(row.date)}</text>}
        <circle cx={x(i)} cy={y(row.values[metric])} r={hover === i ? 6 : rows.length <= 30 ? 3 : 0} fill={colors[metric]} />
        <rect x={x(i) - (width - left - right) / rows.length / 2} y={top} width={(width - left - right) / rows.length + 2} height={height - bottom - top} fill="transparent" tabIndex={0} role="button" aria-label={`${shortDate(row.date)} : ${row.values[metric]} ${labels[metric]}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setHover(i); } }} />
      </g>)}
    </svg>
    <Typography textColor="neutral600">Les utilisateurs sont comptés par jour ; le total de la période reste dédupliqué.</Typography>
  </Box>;
}

export default function Report() {
  const { get } = useFetchClient();
  const [range, setRange] = useState('7');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    get(`/site-analytics/report?range=${range}`).then(({ data: result }) => {
      if (active) setData(result);
    }).catch((failure) => {
      if (active) setError(failure.response?.data?.error?.message || 'Statistiques indisponibles.');
    });
    return () => { active = false; };
  }, [get, range, revision]);
  return <Box padding={8}>
    <Typography variant="alpha" tag="h1">Statistiques du portfolio</Typography>
    <Box paddingTop={3} paddingBottom={6}><Typography textColor="neutral600">Google Analytics · Données actualisées toutes les 5 minutes. La journée en cours peut être incomplète.</Typography></Box>
    <Box paddingBottom={6} style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <label htmlFor="analytics-range"><Typography>Période </Typography></label>
      <select id="analytics-range" value={range} onChange={(event) => setRange(event.target.value)} style={{ padding: 10, borderRadius: 4 }}>
        {['7', '30', '90'].map((days) => <option key={days} value={days}>{days} derniers jours</option>)}
      </select>
      <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>Actualiser</Button>
    </Box>
    {error && <Box role="alert" padding={5} background="danger100"><Typography textColor="danger700">{error}</Typography></Box>}
    {!data && !error && <Typography role="status">Chargement des statistiques…</Typography>}
    {data?.configured === false && <Box padding={6} background="neutral0" hasRadius>
      <Typography tag="h2" variant="beta">Connecter Google Analytics</Typography>
      <Box paddingTop={4}><Typography>Le suivi du site est déjà installé. Pour consulter ses résultats ici, configurez l’identifiant numérique de la propriété GA4 et un compte de service Google autorisé en lecture. Le guide ANALYTICS.md détaille les étapes.</Typography></Box>
    </Box>}
    {data?.configured && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
        {['Utilisateurs actifs', 'Sessions', 'Pages vues', 'Taux d’engagement'].map((label, index) => <Box key={label} padding={5} background="neutral0" hasRadius>
          <Typography textColor="neutral600">{label}</Typography>
          <Box paddingTop={3}><Typography variant="alpha">{index === 3 ? `${number(Math.round(data.overview[index] * 1000) / 10)} %` : number(data.overview[index])}</Typography></Box>
        </Box>)}
      </div>
      {data.timeline?.length > 0 && <Timeline rows={data.timeline} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 20, marginTop: 24 }}>
        {[['Pages les plus consultées', data.pages], ['Sources de trafic', data.sources], ['Pays', data.countries], ['Appareils', data.devices]].map(([title, rows]) => <Box key={title} padding={5} background="neutral0" hasRadius>
          <Typography tag="h2" variant="beta">{title}</Typography>
          {!rows.length && <Box paddingTop={4}><Typography>Aucune donnée sur cette période.</Typography></Box>}
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 20 }}>{rows.map((row) => <li key={row.labels.join('/')} style={{ padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 10 }}><Typography style={{ overflowWrap: 'anywhere' }}>{row.labels.join(' / ')}</Typography><Typography fontWeight="bold">{number(row.values[0])}</Typography></div>
            <div style={{ height: 9, background: 'rgba(124,108,242,0.12)', borderRadius: 8 }}><div style={{ height: '100%', width: `${row.values[0] / Math.max(1, ...rows.map((item) => item.values[0])) * 100}%`, background: title === 'Appareils' ? colors[1] : colors[0], borderRadius: 8 }} /></div>
          </li>)}</ul>
        </Box>)}
      </div>
    </>}
  </Box>;
}
