interface MetricRowProps {
  readonly label: string;
  readonly value: string;
}

interface StatPanelProps {
  readonly description?: string;
  readonly label: string;
  readonly value: string;
}

interface TransportDetailCardProps {
  readonly debugLine: string;
  readonly details: readonly MetricRowProps[];
  readonly errorLine: string;
  readonly summary: string;
  readonly title: string;
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="type-shell-caption">{label}</span>
      <span className="type-shell-body text-right text-[color:var(--shell-foreground)]">
        {value}
      </span>
    </div>
  );
}

function StatPanel({ description, label, value }: StatPanelProps) {
  return (
    <div className="surface-shell-inset rounded-[calc(1rem*var(--game-ui-scale))] p-[calc(1rem*var(--game-ui-scale))]">
      <p className="type-shell-banner">{label}</p>
      {description !== undefined ? (
        <p className="type-shell-detail mt-2">{description}</p>
      ) : null}
      <p className="type-shell-heading mt-3">{value}</p>
    </div>
  );
}

function TransportDetailCard({
  debugLine,
  details,
  errorLine,
  summary,
  title
}: TransportDetailCardProps) {
  return (
    <div className="surface-shell-panel rounded-[calc(1.25rem*var(--game-ui-scale))] p-[calc(1rem*var(--game-ui-scale))]">
      <div className="flex flex-col gap-1">
        <p className="type-shell-banner">{title}</p>
        <p className="type-shell-body">{summary}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="surface-shell-inset rounded-[calc(1rem*var(--game-ui-scale))] px-[calc(1rem*var(--game-ui-scale))] py-[calc(0.9rem*var(--game-ui-scale))]">
          <p className="type-shell-caption">Debug line</p>
          <p className="type-shell-body mt-2">{debugLine}</p>
        </div>

        <div className="flex flex-col gap-2">
          {details.map((detail) => (
            <MetricRow key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </div>

        <div className="surface-shell-inset rounded-[calc(1rem*var(--game-ui-scale))] px-[calc(1rem*var(--game-ui-scale))] py-[calc(0.9rem*var(--game-ui-scale))]">
          <p className="type-shell-caption">Last error</p>
          <p className="type-shell-body mt-2">{errorLine}</p>
        </div>
      </div>
    </div>
  );
}

export {
  MetricRow,
  StatPanel,
  TransportDetailCard,
  type MetricRowProps,
  type StatPanelProps,
  type TransportDetailCardProps
};
