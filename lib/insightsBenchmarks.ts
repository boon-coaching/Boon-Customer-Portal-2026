import { getBenchmarks } from './dataFetcher';

/**
 * Fetches Boon-wide benchmarks for the given program type and formats them
 * as a markdown block suitable for inclusion in the AI insights `internalData`
 * payload.
 *
 * The four-way-test prompt explicitly tells Opus to compare to a benchmark.
 * Without this block, the only benchmarks it can reference are ones it
 * invents, which violates the "never invent data" rule. With this block,
 * it gets concrete avg / p25 / p75 values per metric and a sample size.
 */
export async function buildBenchmarkSection(
  programType: 'Scale' | 'GROW'
): Promise<string> {
  const benchmarks = await getBenchmarks(programType);
  const metricKeys = Object.keys(benchmarks);
  if (metricKeys.length === 0) {
    return '';
  }

  // Human-readable metric labels. Keys not in this map are skipped to avoid
  // sending confusing snake_case identifiers into the prompt.
  const labels: Record<string, string> = {
    nps: 'NPS',
    coach_satisfaction: 'Coach satisfaction (0-10)',
    adoption_rate: 'Adoption rate (%)',
    sessions_per_user: 'Sessions per active user',
    repeat_user_rate: 'Repeat user rate (%)',
    baseline_satisfaction: 'Baseline job satisfaction (1-10)',
    baseline_productivity: 'Baseline productivity (1-10)',
    baseline_work_life_balance: 'Baseline work-life balance (1-10)',
    baseline_motivation: 'Baseline motivation (1-10)',
    baseline_inclusion: 'Baseline inclusion (1-10)',
    competency_pre_avg: 'Competency pre-assessment average (1-5)',
    competency_post_avg: 'Competency post-assessment average (1-5)',
    competency_improvement: 'Competency improvement, points gained (pre to post)',
    focus_stress_anxiety: 'Focus: stress and anxiety (% of participants)',
    focus_leadership: 'Focus: leadership (% of participants)',
    focus_professional_development: 'Focus: professional development (% of participants)',
    focus_work_life_balance: 'Focus: work-life balance (% of participants)',
    focus_relationships: 'Focus: relationships (% of participants)',
  };

  const formatValue = (v: number | string | null | undefined) => {
    if (v === null || v === undefined) return '-';
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!Number.isFinite(n)) return '-';
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };

  const lines = metricKeys
    .filter((key) => labels[key])
    .map((key) => {
      const b = benchmarks[key];
      const label = labels[key];
      return `- ${label}: Boon avg ${formatValue(b.avg)}, 25th percentile ${formatValue(b.p25)}, 75th percentile ${formatValue(b.p75)} (n=${b.sampleSize})`;
    });

  if (lines.length === 0) return '';

  const programLabel = programType === 'GROW' ? 'Grow' : 'Scale';
  return `
### Boon Benchmarks (${programLabel} programs, aggregated across all clients)

Use these to compare this cohort's values. A number above the 75th percentile is top-quartile. Below the 25th percentile is bottom-quartile. Reference a benchmark explicitly when you name a performance signal.

${lines.join('\n')}
`;
}
