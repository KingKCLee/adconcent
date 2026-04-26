interface Props {
  label: string;
  value: string;
  subtitle?: string;
  status?: 'ok' | 'warning' | 'critical';
}

export default function CampaignKPICard({ label, value, subtitle, status = 'ok' }: Props) {
  const colorMap: Record<NonNullable<Props['status']>, string> = {
    ok: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    critical: 'border-red-200 bg-red-50',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorMap[status]}`}>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
