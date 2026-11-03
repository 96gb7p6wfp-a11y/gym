import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';

/** Kept outside the initial phone bundle; the offline worker caches this chunk. */
export default function StrengthChart({ data, metricLabel }: {
  data: { date: string; value: number }[];
  metricLabel: string;
}) {
  return <ResponsiveContainer width="100%" height={280}>
    <LineChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 10 }}>
      <CartesianGrid stroke="var(--line)" vertical={false} />
      <XAxis dataKey="date" tick={{ fill: '#627069', fontSize: 12 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#627069', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
      <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8e3' }} formatter={value => [value, metricLabel]} />
      <Line type="linear" dataKey="value" stroke="var(--accent)" strokeWidth={3}
        dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--canvas)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
    </LineChart>
  </ResponsiveContainer>;
}
