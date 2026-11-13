import {
  FinancialData,
  FinancialDataPoint,
  FinancialDataSeries,
} from "@/lib/services/financial-data";

const SUM_ABS_TOLERANCE = 1;
const SUM_REL_TOLERANCE = 1e-6;

export interface StackSegment {
  name: string;
  /** Legend group. A parent subtotal when this member is nested under one. */
  group: string;
  /** True when the member is drawn inside a parent rather than as the parent. */
  nested: boolean;
  /** Gray bar for the part of the concept a breakdown does not cover. */
  conceptTotal: boolean;
}

export interface PeriodLeaf {
  name: string;
  group: string;
  nested: boolean;
  value: number;
}

/**
 * One way to split the concept. Alternatives are mutually exclusive.
 * A period may cover only part of the concept; the gap is the gray bar.
 */
export interface StackCut {
  id: string;
  /** Top-level members, used as the legend heading. */
  label: string;
  segments: StackSegment[];
  values: Record<string, Record<string, number>>;
  periods: Record<string, PeriodLeaf[]>;
}

export interface DimensionStack {
  /** Bar series, bottom of the stack first. */
  segments: StackSegment[];
  dates: string[];
  values: Record<string, Record<string, number>>;
  /** Leaves actually reported for that period, in stack order. */
  periods: Record<string, PeriodLeaf[]>;
  fiscalQuarter: Record<string, number | undefined>;
  /**
   * Alternative splits reported for the same periods, such as two geography
   * cuts. Empty when there is only one split. A split can fall short of the
   * concept; the gap is drawn as the gray concept bar.
   */
  cuts: StackCut[];
  /** Split shown until the user picks another. */
  defaultCutId: string | null;
}

interface LeafDraft {
  name: string;
  group: string;
  nested: boolean;
  value: number;
}

type PointIndex = Map<string, Map<string, FinancialDataPoint>>;

/**
 * Build the bar stack for a chart.
 *
 * Dimension members overlap: a parent such as Products and the products that
 * add up to it are separate series. Plotting both would exceed the concept.
 * Each period's `breakdowns` list the members that sum to a value. A partial
 * breakdown is the same kind of split but falls short: those members are
 * still stacked, and the gap is a gray bar of the concept. A member expands
 * into its own breakdown only when that breakdown sums to the member. The
 * parent is then a group around those leaves, not a second bar.
 */
export function resolveDimensionStack(
  data: FinancialData,
  axis: string | null
): DimensionStack {
  if (!axis || !data.total) {
    return stackFromSeries(data.series);
  }
  return stackFromBreakdowns(data, axis);
}

function stackFromSeries(series: FinancialDataSeries[]): DimensionStack {
  const dates = uniqueDates(
    series.flatMap(item => item.data.map(point => point.date))
  );
  const segments: StackSegment[] = series.map(item => ({
    name: item.name,
    group: item.name,
    nested: false,
    conceptTotal: false,
  }));

  const values: DimensionStack["values"] = {};
  const periods: DimensionStack["periods"] = {};
  const fiscalQuarter: DimensionStack["fiscalQuarter"] = {};

  for (const date of dates) {
    values[date] = {};
    const leaves: PeriodLeaf[] = [];
    for (const item of series) {
      const point = item.data.find(candidate => candidate.date === date);
      const value = point?.value ?? 0;
      values[date][item.name] = value;
      if (point && value !== 0) {
        leaves.push({
          name: item.name,
          group: item.name,
          nested: false,
          value,
        });
      }
      if (point?.fiscal_quarter != null && fiscalQuarter[date] == null) {
        fiscalQuarter[date] = point.fiscal_quarter;
      }
    }
    periods[date] = leaves;
  }

  return {
    segments,
    dates,
    values,
    periods,
    fiscalQuarter,
    cuts: [],
    defaultCutId: null,
  };
}

function stackFromBreakdowns(
  data: FinancialData,
  axis: string
): DimensionStack {
  const total = data.total;
  if (!total) {
    return stackFromSeries(data.series);
  }

  const points = indexPoints(data.series);
  const totalPoints = new Map(total.data.map(point => [point.date, point]));
  const dates = [...totalPoints.keys()].sort((a, b) => a.localeCompare(b));

  const partitionsByDate = new Map<string, Partition[]>();
  for (const date of dates) {
    const totalPoint = totalPoints.get(date);
    const totalValue = totalPoint?.value;
    if (totalValue == null) continue;
    partitionsByDate.set(
      date,
      partitionsOfConcept(totalValue, totalPoint, date, axis, points)
    );
  }

  const cuts = clusterCuts(dates, partitionsByDate);
  if (!cuts) {
    const resolved = new Map<string, PeriodDraft>();
    for (const date of dates) {
      const draft = draftForDate(
        partitionsByDate.get(date) ?? [],
        totalPoints.get(date)?.value
      );
      if (draft) resolved.set(date, draft);
    }
    return {
      ...materialize(data.metric, dates, resolved, totalPoints, points),
      cuts: [],
      defaultCutId: null,
    };
  }

  const built = cuts.map(cut => {
    const resolved = new Map<string, PeriodDraft>();
    for (const date of dates) {
      const leaves = cut.byDate.get(date);
      const totalValue = totalPoints.get(date)?.value;
      const draft =
        leaves && leaves.length > 0
          ? draftFromLeaves(leaves, totalValue)
          : totalValue != null
            ? { leaves: [], remainder: totalValue }
            : null;
      if (draft) resolved.set(date, draft);
    }
    const view = materialize(data.metric, dates, resolved, totalPoints, points);
    return {
      id: cut.id,
      label: formatCutLabel(cut.labelMembers),
      topRankCount: cut.topRankCount,
      memberCount: cut.labelMembers.length,
      segments: view.segments,
      values: view.values,
      periods: view.periods,
      fiscalQuarter: view.fiscalQuarter,
    };
  });

  built.sort((a, b) => {
    if (b.topRankCount !== a.topRankCount)
      return b.topRankCount - a.topRankCount;
    if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
    return a.label.localeCompare(b.label);
  });

  const [preferred] = built;
  return {
    segments: preferred.segments,
    dates,
    values: preferred.values,
    periods: preferred.periods,
    fiscalQuarter: preferred.fiscalQuarter,
    cuts: built.map(cut => ({
      id: cut.id,
      label: cut.label,
      segments: cut.segments,
      values: cut.values,
      periods: cut.periods,
    })),
    defaultCutId: preferred.id,
  };
}

interface Partition {
  signature: string;
  members: string[];
  leaves: LeafDraft[];
  /** Members sum to the concept. False when the breakdown is a shortfall. */
  exact: boolean;
}

/** Leaves for one period, plus the concept gap drawn in gray. */
interface PeriodDraft {
  leaves: LeafDraft[];
  remainder: number;
}

interface MemberList {
  members: string[];
  partial: boolean;
}

interface CutAccumulator {
  id: string;
  labelMembers: string[];
  memberSets: string[][];
  topRankCount: number;
  byDate: Map<string, LeafDraft[]>;
}

/**
 * Group co-existing splits into mutually exclusive cuts.
 * A single evolving split (no period reports two of them) stays one cut.
 */
function clusterCuts(
  dates: string[],
  partitionsByDate: Map<string, Partition[]>
): CutAccumulator[] | null {
  const hasAlternative = [...partitionsByDate.values()].some(
    list => list.length > 1
  );
  if (!hasAlternative) return null;

  const cuts: CutAccumulator[] = [];
  const newestFirst = [...dates].sort((a, b) => b.localeCompare(a));
  for (const date of newestFirst) {
    const partitions = partitionsByDate.get(date) ?? [];
    const used = new Set<CutAccumulator>();
    partitions.forEach((partition, index) => {
      let best: { cut: CutAccumulator; score: number } | null = null;
      for (const cut of cuts) {
        if (used.has(cut)) continue;
        const score = cut.memberSets.reduce(
          (max, members) => Math.max(max, affinity(members, partition.members)),
          0
        );
        if (!best || score > best.score) best = { cut, score };
      }

      let cut: CutAccumulator;
      if (best && best.score >= 0.5) {
        cut = best.cut;
      } else {
        cut = {
          id: partition.signature,
          labelMembers: partition.members,
          memberSets: [],
          topRankCount: 0,
          byDate: new Map(),
        };
        cuts.push(cut);
      }
      used.add(cut);
      if (
        !cut.memberSets.some(
          members => memberSignature(members) === partition.signature
        )
      ) {
        cut.memberSets.push(partition.members);
      }
      if (index === 0) cut.topRankCount += 1;
      cut.byDate.set(date, partition.leaves);
    });
  }

  return cuts.length > 1 ? cuts : null;
}

function partitionsOfConcept(
  totalValue: number,
  totalPoint: FinancialDataPoint | undefined,
  date: string,
  axis: string,
  points: PointIndex
): Partition[] {
  const ranked = rankBreakdowns(
    breakdownLists(totalPoint, axis),
    date,
    axis,
    points
  );
  const found: Partition[] = [];
  for (const list of ranked) {
    const leaves = tryPartition(list.members, date, axis, points);
    if (!leaves || leaves.length === 0) continue;
    const sum = sumLeaves(leaves);
    if (sum === 0) continue;
    const exact = sumsMatch(sum, totalValue);
    // A partial breakdown is a known split that falls short. Anything over
    // the concept would stack past the total, so it is left out.
    if (!exact && (!list.partial || sum > totalValue)) continue;
    // A finer split already covers these members.
    if (found.some(partition => isSubset(list.members, partition.members))) {
      continue;
    }
    const signature = memberSignature(list.members);
    if (found.some(partition => partition.signature === signature)) continue;
    found.push({ signature, members: [...list.members], leaves, exact });
  }
  // A short list that only repeats pieces of a complete split is the same
  // story with holes, so it is not a second cut.
  const complete = found.filter(partition => partition.exact);
  if (complete.length === 0) return found;
  const covered = new Set<string>();
  for (const partition of complete) {
    for (const member of partition.members) covered.add(member);
    for (const leaf of partition.leaves) covered.add(leaf.name);
  }
  return [
    ...complete,
    ...found.filter(
      partition =>
        !partition.exact &&
        partition.leaves.some(leaf => !covered.has(leaf.name))
    ),
  ];
}

function draftForDate(
  partitions: Partition[],
  totalValue: number | undefined
): PeriodDraft | null {
  if (partitions.length > 0 && totalValue != null) {
    return draftFromLeaves(partitions[0].leaves, totalValue);
  }
  if (totalValue != null) return { leaves: [], remainder: totalValue };
  return null;
}

function draftFromLeaves(
  leaves: LeafDraft[],
  totalValue: number | undefined
): PeriodDraft {
  if (totalValue == null) return { leaves, remainder: 0 };
  return { leaves, remainder: unallocated(sumLeaves(leaves), totalValue) };
}

function tryPartition(
  members: string[],
  date: string,
  axis: string,
  points: PointIndex
): LeafDraft[] | null {
  const seen = new Set<string>();
  const leaves: LeafDraft[] = [];
  for (const member of members) {
    const expanded = expandMember(
      member,
      date,
      member,
      false,
      axis,
      points,
      seen
    );
    if (!expanded) return null;
    for (const leaf of expanded) seen.add(leaf.name);
    seen.add(member);
    leaves.push(...expanded);
  }
  return leaves;
}

function materialize(
  metric: string,
  dates: string[],
  resolved: Map<string, PeriodDraft>,
  totalPoints: Map<string, FinancialDataPoint>,
  points: PointIndex
): Pick<
  DimensionStack,
  "segments" | "dates" | "values" | "periods" | "fiscalQuarter"
> {
  const leafNames = new Set<string>();
  for (const period of resolved.values()) {
    for (const leaf of period.leaves) leafNames.add(leaf.name);
  }

  const conceptName = unusedName(metric, leafNames);
  const needsConcept = [...resolved.values()].some(
    period => period.remainder > 0
  );
  const nestedGroup = new Map<string, string>();
  for (const date of [...dates].reverse()) {
    const period = resolved.get(date);
    if (!period) continue;
    for (const leaf of period.leaves) {
      if (leaf.nested && !nestedGroup.has(leaf.name)) {
        nestedGroup.set(leaf.name, leaf.group);
      }
    }
  }

  const segments: StackSegment[] = [...leafNames].map(name => ({
    name,
    group: nestedGroup.get(name) ?? name,
    nested: nestedGroup.has(name),
    conceptTotal: false,
  }));
  if (needsConcept) {
    segments.push({
      name: conceptName,
      group: conceptName,
      nested: false,
      conceptTotal: true,
    });
  }

  const values: DimensionStack["values"] = {};
  const periods: DimensionStack["periods"] = {};
  const fiscalQuarter: DimensionStack["fiscalQuarter"] = {};

  for (const date of dates) {
    const period = resolved.get(date);
    const periodLeaves: PeriodLeaf[] = [...(period?.leaves ?? [])];
    if (period && period.remainder > 0) {
      periodLeaves.push({
        name: conceptName,
        group: conceptName,
        nested: false,
        value: period.remainder,
      });
    }

    values[date] = {};
    for (const segment of segments) values[date][segment.name] = 0;
    for (const leaf of periodLeaves) values[date][leaf.name] = leaf.value;
    periods[date] = periodLeaves;

    const quarter =
      totalPoints.get(date)?.fiscal_quarter ??
      firstQuarter(points, periodLeaves, date);
    if (quarter != null) fiscalQuarter[date] = quarter;
  }

  orderSegments(segments, dates, values);
  for (const date of dates) {
    const order = new Map(
      segments.map((segment, index) => [segment.name, index])
    );
    periods[date] = [...periods[date]].sort(
      (a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0)
    );
  }

  return { segments, dates, values, periods, fiscalQuarter };
}

/** The plotted stack for one alternative split. */
export function viewForCut(
  stack: DimensionStack,
  cutId: string | null
): DimensionStack {
  if (stack.cuts.length < 2) return stack;
  const cut =
    stack.cuts.find(item => item.id === cutId) ??
    stack.cuts.find(item => item.id === stack.defaultCutId) ??
    stack.cuts[0];
  return {
    ...stack,
    segments: cut.segments,
    values: cut.values,
    periods: cut.periods,
  };
}

function formatCutLabel(members: string[]): string {
  if (members.length <= 3) return members.join(", ");
  return `${members.slice(0, 2).join(", ")} + ${members.length - 2}`;
}

function memberSignature(members: string[]): string {
  return [...members].sort((a, b) => a.localeCompare(b)).join("\0");
}

function jaccard(leftMembers: string[], rightMembers: string[]): number {
  const left = new Set(leftMembers);
  const right = new Set(rightMembers);
  let intersection = 0;
  for (const member of left) {
    if (right.has(member)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/** Same split across years, including a year that reports only some members. */
function affinity(leftMembers: string[], rightMembers: string[]): number {
  if (
    isSubset(leftMembers, rightMembers) ||
    isSubset(rightMembers, leftMembers)
  ) {
    return 1;
  }
  return jaccard(leftMembers, rightMembers);
}

function isSubset(subset: string[], superset: string[]): boolean {
  if (subset.length > superset.length) return false;
  const set = new Set(superset);
  return subset.every(member => set.has(member));
}

function expandMember(
  name: string,
  date: string,
  group: string,
  nested: boolean,
  axis: string,
  points: PointIndex,
  seen: Set<string>
): LeafDraft[] | null {
  if (seen.has(name)) return null;

  const point = points.get(name)?.get(date);
  const own = point ? point.value : null;
  const nextSeen = new Set(seen);
  nextSeen.add(name);

  for (const list of rankBreakdowns(
    breakdownLists(point, axis),
    date,
    axis,
    points
  )) {
    // A short child list stays collapsed into the member. The gray bar is the
    // gap against the concept, not a second remainder inside the parent.
    if (list.partial) continue;
    const leaves: LeafDraft[] = [];
    let ok = true;
    const childSeen = new Set(nextSeen);
    for (const child of list.members) {
      const expanded = expandMember(
        child,
        date,
        group,
        true,
        axis,
        points,
        childSeen
      );
      if (!expanded) {
        ok = false;
        break;
      }
      for (const leaf of expanded) childSeen.add(leaf.name);
      childSeen.add(child);
      leaves.push(...expanded);
    }
    if (!ok || leaves.length === 0) continue;
    if (own == null || sumsMatch(sumLeaves(leaves), own)) return leaves;
  }

  if (own == null) return null;
  return [{ name, group, nested, value: own }];
}

function breakdownLists(
  point: FinancialDataPoint | undefined,
  axis: string
): MemberList[] {
  if (!point?.breakdowns?.length) return [];
  const lists: MemberList[] = [];
  for (const breakdown of point.breakdowns) {
    if (breakdown.axis !== axis) continue;
    const members: string[] = [];
    const seen = new Set<string>();
    for (const member of breakdown.members) {
      if (!member || seen.has(member)) continue;
      seen.add(member);
      members.push(member);
    }
    if (members.length > 0) {
      lists.push({ members, partial: breakdown.partial === true });
    }
  }
  return lists;
}

function rankBreakdowns(
  lists: MemberList[],
  date: string,
  axis: string,
  points: PointIndex
): MemberList[] {
  return [...lists].sort((a, b) => {
    if (a.partial !== b.partial) return a.partial ? 1 : -1;
    const aScore = breakdownScore(a.members, date, axis, points);
    const bScore = breakdownScore(b.members, date, axis, points);
    if (bScore[0] !== aScore[0]) return bScore[0] - aScore[0];
    if (bScore[1] !== aScore[1]) return bScore[1] - aScore[1];
    return a.members.join("\0").localeCompare(b.members.join("\0"));
  });
}

/** Prefer a split whose members themselves break down, then the finer split. */
function breakdownScore(
  members: string[],
  date: string,
  axis: string,
  points: PointIndex
): [number, number] {
  let nested = 0;
  for (const member of members) {
    const point = points.get(member)?.get(date);
    if (breakdownLists(point, axis).length > 0) nested += 1;
  }
  return [nested, members.length];
}

function sumsMatch(sum: number, target: number): boolean {
  const diff = Math.abs(sum - target);
  return (
    diff <= SUM_ABS_TOLERANCE || diff <= Math.abs(target) * SUM_REL_TOLERANCE
  );
}

/** Positive gap between a short split and the concept. Zero when they match. */
function unallocated(sum: number, total: number): number {
  if (sumsMatch(sum, total)) return 0;
  const gap = total - sum;
  return gap > 0 ? gap : 0;
}

function sumLeaves(leaves: LeafDraft[]): number {
  return leaves.reduce((sum, leaf) => sum + leaf.value, 0);
}

function orderSegments(
  segments: StackSegment[],
  dates: string[],
  values: DimensionStack["values"]
): void {
  const leafTotal = new Map<string, number>();
  const groupTotal = new Map<string, number>();
  for (const segment of segments) {
    let total = 0;
    for (const date of dates) total += values[date]?.[segment.name] ?? 0;
    leafTotal.set(segment.name, total);
    groupTotal.set(segment.group, (groupTotal.get(segment.group) ?? 0) + total);
  }

  const groupOrder = new Map<string, number>();
  const groups = [...groupTotal.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  groups.forEach(([group], index) => groupOrder.set(group, index));

  segments.sort((a, b) => {
    if (a.conceptTotal !== b.conceptTotal) return a.conceptTotal ? 1 : -1;
    const groupDiff =
      (groupOrder.get(a.group) ?? 0) - (groupOrder.get(b.group) ?? 0);
    if (groupDiff !== 0) return groupDiff;
    const aTotal = leafTotal.get(a.name) ?? 0;
    const bTotal = leafTotal.get(b.name) ?? 0;
    if (bTotal !== aTotal) return bTotal - aTotal;
    return a.name.localeCompare(b.name);
  });
}

function indexPoints(series: FinancialDataSeries[]): PointIndex {
  const index: PointIndex = new Map();
  for (const item of series) {
    const byDate = new Map<string, FinancialDataPoint>();
    for (const point of item.data) byDate.set(point.date, point);
    index.set(item.name, byDate);
  }
  return index;
}

function uniqueDates(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => a.localeCompare(b));
}

function unusedName(preferred: string, used: Set<string>): string {
  if (!used.has(preferred)) return preferred;
  const labeled = `${preferred} (total)`;
  if (!used.has(labeled)) return labeled;
  return `${preferred} (unsplit)`;
}

function firstQuarter(
  points: PointIndex,
  leaves: PeriodLeaf[],
  date: string
): number | undefined {
  for (const leaf of leaves) {
    const quarter = points.get(leaf.name)?.get(date)?.fiscal_quarter;
    if (quarter != null) return quarter;
  }
  return undefined;
}
