import React from 'react';

interface Props {
  weekly: Array<{ week: number; combined: number }>;
  /** Day offsets where steps fire, in business days from t=0 */
  stepMarkers: Array<{ week: number; label: string; kind: string }>;
}

const kindColor: Record<string, string> = {
  straight: 'rgb(245 158 11)',     // amber
  reverse: 'rgb(16 185 129)',      // emerald
  'add-position': 'rgb(244 63 94)',// rose
  wait: 'rgb(100 116 139)',        // slate
};

export function ScenarioSparkline({ weekly, stepMarkers }: Props) {
  if (!weekly.length) return null;
  const W = 600;
  const H = 120;
  const pad = 20;
  const maxY = Math.max(1, ...weekly.map(w => w.combined));
  const maxX = Math.max(1, weekly[weekly.length - 1].week);

  const x = (w: number) => pad + (w / maxX) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / maxY) * (H - pad * 2);

  const path = weekly
    .map((w, i) => `${i === 0 ? 'M' : 'L'}${x(w.week).toFixed(1)},${y(w.combined).toFixed(1)}`)
    .join(' ');

  const area = `${path} L${x(weekly[weekly.length - 1].week).toFixed(1)},${(H - pad).toFixed(1)} L${x(0).toFixed(1)},${(H - pad).toFixed(1)} Z`;

  return (
    <div className="rounded-md border border-border p-3 bg-card">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        Total Exposure Timeline
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        <path d={area} fill="hsl(var(--primary) / 0.10)" />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.8} />
        {/* y-axis labels */}
        <text x={pad} y={pad - 4} fontSize="9" fill="hsl(var(--muted-foreground))">
          ${(maxY / 1000).toFixed(0)}k
        </text>
        <text x={pad} y={H - pad + 12} fontSize="9" fill="hsl(var(--muted-foreground))">$0</text>
        {/* x ticks */}
        {[0, Math.round(maxX / 2), maxX].map(w => (
          <g key={w}>
            <text x={x(w)} y={H - 4} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle">
              wk {w}
            </text>
          </g>
        ))}
        {/* step markers */}
        {stepMarkers.map((m, i) => (
          <g key={i}>
            <line
              x1={x(m.week)} x2={x(m.week)} y1={pad} y2={H - pad}
              stroke={kindColor[m.kind] || 'rgb(100 116 139)'}
              strokeWidth={1} strokeDasharray="2 2"
            />
            <text
              x={x(m.week)} y={pad + 9 + (i % 2) * 10}
              fontSize="9" fill={kindColor[m.kind] || 'rgb(100 116 139)'}
              textAnchor="middle"
            >
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
