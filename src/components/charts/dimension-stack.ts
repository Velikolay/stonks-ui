import {
  FinancialData,
  FinancialDataPoint,
  FinancialDataSeries,
} from "@/lib/services/financial-data";

const SUM_ABS_TOLERANCE = 1;
const SUM_REL_TOLERANCE = 1e-6;
// A restated quarter can leave the year-to-date roll-forward about a million
// dollars off a hundred-billion total. That miss is still the hedge.
const OVERAGE_REL_TOLERANCE = 1e-5;

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
  /** Gray bar for the part of a drilled member its own split does not cover. */
  conceptTotal?: boolean;
}

type PointIndex = Map<string, Map<string, FinancialDataPoint>>;

/**
 * Build the bar stack for a chart.
 *
 * Each breakdown on the concept series is one way to split it. Two breakdowns
 * on the same axis are alternatives: the chart shows one at a time and never
 * mixes their members. For each period, only members that have a value are
 * used. A member that is absent, but whose own breakdown has values, is drawn
 * as those children, so product lines still appear in years before a Products
 * subtotal was reported. The gap up to the concept is a gray bar named with
 * the metric. A series the breakdowns never name is drawn only when its value
 * closes that gap, which is how Other Products joins iPhone, iPad, and Mac in
 * the years those lines added up. A gap below zero means that split does not
 * apply to the period. A member that itself has breakdowns, such as Products,
 * is drawn as those children when they do not exceed it.
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
  const childLists = breakdownMap(data.series, axis);
  const namedMembers = breakdownMemberNames(data, axis);
  const totalPoints = new Map(total.data.map(point => [point.date, point]));
  const dates = [...totalPoints.keys()].sort((a, b) => a.localeCompare(b));
  const splits = (total.breakdowns ?? []).filter(
    breakdown => breakdown.axis === axis && breakdown.members.length > 0
  );

  if (splits.length === 0) {
    const resolved = new Map<string, PeriodDraft>();
    for (const date of dates) {
      const totalValue = totalPoints.get(date)?.value;
      if (totalValue == null) continue;
      resolved.set(date, { leaves: [], remainder: totalValue });
    }
    return {
      ...materialize(data.metric, dates, resolved, totalPoints, points),
      cuts: [],
      defaultCutId: null,
    };
  }

  const built = splits.map(split => {
    const resolved = new Map<string, PeriodDraft>();
    let exactPeriods = 0;
    for (const date of dates) {
      const totalValue = totalPoints.get(date)?.value;
      if (totalValue == null) continue;
      const draft = periodForSplit(
        split.members,
        totalValue,
        date,
        points,
        childLists,
        namedMembers
      );
      resolved.set(date, draft);
      if (draft.leaves.length > 0 && draft.remainder === 0) exactPeriods += 1;
    }
    const view = materialize(data.metric, dates, resolved, totalPoints, points);
    return {
      id: memberSignature(split.members),
      label: formatCutLabel(split.members),
      members: split.members,
      nested: split.members.filter(member => childLists.has(member)).length,
      exactPeriods,
      segments: view.segments,
      values: view.values,
      periods: view.periods,
      fiscalQuarter: view.fiscalQuarter,
    };
  });

  built.sort((a, b) => {
    if (b.nested !== a.nested) return b.nested - a.nested;
    if (b.members.length !== a.members.length) {
      return b.members.length - a.members.length;
    }
    if (b.exactPeriods !== a.exactPeriods)
      return b.exactPeriods - a.exactPeriods;
    return a.label.localeCompare(b.label);
  });

  const [preferred] = built;
  if (built.length < 2) {
    return {
      segments: preferred.segments,
      dates,
      values: preferred.values,
      periods: preferred.periods,
      fiscalQuarter: preferred.fiscalQuarter,
      cuts: [],
      defaultCutId: null,
    };
  }

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

/** Member name to the alternative child splits reported on that member's series. */
function breakdownMap(
  series: FinancialDataSeries[],
  axis: string
): Map<string, string[][]> {
  const map = new Map<string, string[][]>();
  for (const item of series) {
    const lists = (item.breakdowns ?? [])
      .filter(
        breakdown => breakdown.axis === axis && breakdown.members.length > 0
      )
      .map(breakdown => breakdown.members);
    if (lists.length > 0) map.set(item.name, lists);
  }
  return map;
}

/** Every member named by a breakdown on this axis, including child splits. */
function breakdownMemberNames(data: FinancialData, axis: string): Set<string> {
  const names = new Set<string>();
  const lists = [
    ...(data.total?.breakdowns ?? []),
    ...data.series.flatMap(item => item.breakdowns ?? []),
  ];
  for (const breakdown of lists) {
    if (breakdown.axis !== axis) continue;
    for (const member of breakdown.members) names.add(member);
  }
  return names;
}

/**
 * One concept breakdown for one period.
 * Absent members are skipped. When an absent member's children have values,
 * those children stand in for it. A split that runs past the total is kept
 * when an omitted negative series, such as hedging losses, closes the gap.
 */
function periodForSplit(
  members: string[],
  totalValue: number,
  date: string,
  points: PointIndex,
  childLists: Map<string, string[][]>,
  namedMembers: Set<string>
): PeriodDraft {
  const stoodIn = assemblePeriod(members, date, points, childLists, true);
  if (stoodIn.leaves.length > 0) {
    if (stoodIn.memberSum - totalValue <= tolerance(totalValue)) {
      return closeGap(stoodIn, totalValue, date, points, namedMembers);
    }
    const closed = closeOverage(stoodIn, totalValue, date, points);
    if (closed) return closed;
  }

  const reported = assemblePeriod(members, date, points, childLists, false);
  if (reported.leaves.length === 0) {
    return { leaves: [], remainder: totalValue };
  }
  if (reported.memberSum - totalValue > tolerance(totalValue)) {
    return (
      closeOverage(reported, totalValue, date, points) ?? {
        leaves: [],
        remainder: totalValue,
      }
    );
  }
  return closeGap(reported, totalValue, date, points, namedMembers);
}

interface AssembledPeriod {
  leaves: LeafDraft[];
  memberSum: number;
  /** Parent replaced by its children. Set only when exactly one parent was. */
  substituted: string | null;
}

function assemblePeriod(
  members: string[],
  date: string,
  points: PointIndex,
  childLists: Map<string, string[][]>,
  allowStandIn: boolean
): AssembledPeriod {
  const leaves: LeafDraft[] = [];
  let memberSum = 0;
  let substituted: string | null = null;
  let substitutions = 0;
  const splitMembers = new Set(members);

  for (const member of members) {
    const own = points.get(member)?.get(date)?.value;
    if (own != null) {
      memberSum += own;
      leaves.push(
        ...drillMember(
          member,
          own,
          date,
          member,
          false,
          points,
          childLists,
          new Set()
        )
      );
      continue;
    }
    if (!allowStandIn) continue;
    const standIn = childrenInstead(
      member,
      date,
      points,
      childLists,
      splitMembers
    );
    if (!standIn) continue;
    memberSum += sumLeaves(standIn);
    leaves.push(...standIn);
    substitutions += 1;
    substituted = member;
  }

  return {
    leaves,
    memberSum,
    substituted: substitutions === 1 ? substituted : null,
  };
}

/**
 * Children of a member that was not reported this period.
 * They keep the parent's legend group, since they are that member's breakdown.
 */
function childrenInstead(
  name: string,
  date: string,
  points: PointIndex,
  childLists: Map<string, string[][]>,
  splitMembers: Set<string>
): LeafDraft[] | null {
  const ancestors = new Set([name]);
  for (const members of rankChildLists(
    childLists.get(name) ?? [],
    childLists
  )) {
    const present = members.filter(
      member =>
        member !== name &&
        !splitMembers.has(member) &&
        points.get(member)?.has(date)
    );
    if (present.length === 0) continue;

    const leaves: LeafDraft[] = [];
    for (const child of present) {
      const childValue = points.get(child)?.get(date)?.value ?? 0;
      leaves.push(
        ...drillMember(
          child,
          childValue,
          date,
          name,
          true,
          points,
          childLists,
          ancestors
        )
      );
    }
    return leaves;
  }
  return null;
}

/**
 * Draw unnamed series only when they make this period add up.
 * Other Products is the case: it is no longer its own concept split, and it
 * is not a child of Products, but with iPhone, iPad, and Mac it closes the
 * years before the Products subtotal.
 */
function closeGap(
  assembled: AssembledPeriod,
  totalValue: number,
  date: string,
  points: PointIndex,
  namedMembers: Set<string>
): PeriodDraft {
  const remainder = unallocated(assembled.memberSum, totalValue);
  if (remainder === 0) return { leaves: assembled.leaves, remainder };

  const used = new Set(assembled.leaves.map(leaf => leaf.name));
  const extra = exactFillers(date, remainder, used, namedMembers, points);
  if (!extra) return { leaves: assembled.leaves, remainder };

  const group = assembled.substituted;
  for (const leaf of extra) {
    if (group) {
      leaf.group = group;
      leaf.nested = true;
    }
    assembled.leaves.push(leaf);
  }
  return { leaves: assembled.leaves, remainder: 0 };
}

/**
 * Pull in negative series that bring an over-sum back to the concept.
 * Hedging losses are the usual case: regions and segments are reported before
 * them, so their sum sits above revenue until the loss is included.
 */
function closeOverage(
  assembled: AssembledPeriod,
  totalValue: number,
  date: string,
  points: PointIndex
): PeriodDraft | null {
  const excess = assembled.memberSum - totalValue;
  const used = new Set(assembled.leaves.map(leaf => leaf.name));
  const extra = negativeFillers(date, excess, used, points, totalValue);
  if (!extra) return null;
  assembled.leaves.push(...extra);
  return { leaves: assembled.leaves, remainder: 0 };
}

function negativeFillers(
  date: string,
  excess: number,
  used: Set<string>,
  points: PointIndex,
  totalValue: number
): LeafDraft[] | null {
  const target = -excess;
  const band = Math.max(
    tolerance(totalValue),
    Math.abs(totalValue) * OVERAGE_REL_TOLERANCE
  );
  const candidates: Array<{ name: string; value: number }> = [];
  for (const [name, byDate] of points) {
    if (used.has(name)) continue;
    const value = byDate.get(date)?.value;
    if (value == null || value >= 0) continue;
    if (Math.abs(value - target) > band) continue;
    candidates.push({ name, value });
  }
  candidates.sort(
    (a, b) =>
      Math.abs(a.value - target) - Math.abs(b.value - target) ||
      a.name.localeCompare(b.name)
  );
  if (candidates.length === 0) return null;
  candidates.splice(16);

  let bestMask: number | null = null;
  let bestCount = -1;
  let bestKey = "";
  for (let mask = 1; mask < 1 << candidates.length; mask += 1) {
    let sum = 0;
    let count = 0;
    const names: string[] = [];
    for (let index = 0; index < candidates.length; index += 1) {
      if ((mask & (1 << index)) === 0) continue;
      sum += candidates[index].value;
      count += 1;
      names.push(candidates[index].name);
    }
    if (Math.abs(sum - target) > band) continue;
    const key = names.join("\0");
    if (
      count > bestCount ||
      (count === bestCount && (bestMask == null || key < bestKey))
    ) {
      bestCount = count;
      bestMask = mask;
      bestKey = key;
    }
  }
  if (bestMask == null) return null;

  const leaves: LeafDraft[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    if ((bestMask & (1 << index)) === 0) continue;
    const candidate = candidates[index];
    leaves.push({
      name: candidate.name,
      group: candidate.name,
      nested: false,
      value: candidate.value,
    });
  }
  return leaves;
}

function exactFillers(
  date: string,
  remainder: number,
  used: Set<string>,
  namedMembers: Set<string>,
  points: PointIndex
): LeafDraft[] | null {
  const candidates: Array<{ name: string; value: number }> = [];
  for (const [name, byDate] of points) {
    if (used.has(name) || namedMembers.has(name)) continue;
    const value = byDate.get(date)?.value;
    if (value == null || value <= 0) continue;
    if (value - remainder > tolerance(remainder)) continue;
    candidates.push({ name, value });
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name));
  if (candidates.length === 0 || candidates.length > 16) return null;

  let bestMask: number | null = null;
  let bestCount = -1;
  let bestKey = "";
  for (let mask = 1; mask < 1 << candidates.length; mask += 1) {
    let sum = 0;
    let count = 0;
    const names: string[] = [];
    for (let index = 0; index < candidates.length; index += 1) {
      if ((mask & (1 << index)) === 0) continue;
      sum += candidates[index].value;
      count += 1;
      names.push(candidates[index].name);
    }
    if (!sumsMatch(sum, remainder)) continue;
    const key = names.join("\0");
    if (
      count > bestCount ||
      (count === bestCount && (bestMask == null || key < bestKey))
    ) {
      bestCount = count;
      bestMask = mask;
      bestKey = key;
    }
  }
  if (bestMask == null) return null;

  const leaves: LeafDraft[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    if ((bestMask & (1 << index)) === 0) continue;
    const candidate = candidates[index];
    leaves.push({
      name: candidate.name,
      group: candidate.name,
      nested: false,
      value: candidate.value,
    });
  }
  return leaves;
}

function rankChildLists(
  lists: string[][],
  childLists: Map<string, string[][]>
): string[][] {
  return [...lists].sort((a, b) => {
    const aNested = a.filter(member => childLists.has(member)).length;
    const bNested = b.filter(member => childLists.has(member)).length;
    if (bNested !== aNested) return bNested - aNested;
    if (b.length !== a.length) return b.length - a.length;
    return a.join("\0").localeCompare(b.join("\0"));
  });
}

/**
 * Replace a member with its own breakdown when that breakdown does not exceed
 * the member. A shortfall stays as a gray bar named with the member.
 */
function drillMember(
  name: string,
  own: number,
  date: string,
  group: string,
  nested: boolean,
  points: PointIndex,
  childLists: Map<string, string[][]>,
  ancestors: Set<string>
): LeafDraft[] {
  const self: LeafDraft = { name, group, nested, value: own };
  if (ancestors.has(name)) return [self];

  const lists = rankChildLists(childLists.get(name) ?? [], childLists);

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(name);
  let bestShort: LeafDraft[] | null = null;
  let bestCoverage = -Infinity;

  for (const members of lists) {
    const present = members.filter(
      member =>
        member !== name &&
        points.get(member)?.has(date) &&
        !nextAncestors.has(member)
    );
    if (present.length === 0) continue;

    const leaves: LeafDraft[] = [];
    for (const child of present) {
      const childValue = points.get(child)?.get(date)?.value ?? 0;
      leaves.push(
        ...drillMember(
          child,
          childValue,
          date,
          group,
          true,
          points,
          childLists,
          nextAncestors
        )
      );
    }
    const covered = sumLeaves(leaves);
    const gap = own - covered;
    if (gap < -tolerance(own)) continue;
    if (sumsMatch(covered, own)) return leaves;

    if (covered > bestCoverage) {
      bestCoverage = covered;
      bestShort = [
        ...leaves,
        {
          name,
          group: name,
          nested: false,
          value: gap,
          conceptTotal: true,
        },
      ];
    }
  }

  return bestShort ?? [self];
}

/** Leaves for one period, plus the concept gap drawn in gray. */
interface PeriodDraft {
  leaves: LeafDraft[];
  remainder: number;
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
  const plainNames = new Set<string>();
  const remainderNames = new Set<string>();
  for (const period of resolved.values()) {
    for (const leaf of period.leaves) {
      if (leaf.conceptTotal) remainderNames.add(leaf.name);
      else plainNames.add(leaf.name);
    }
  }
  const taken = new Set<string>([...plainNames, ...remainderNames]);
  const remainderAlias = new Map<string, string>();
  for (const name of remainderNames) {
    if (!plainNames.has(name)) continue;
    const alias = unusedName(`${name} (remainder)`, taken);
    remainderAlias.set(name, alias);
    taken.add(alias);
  }
  const displayName = (leaf: LeafDraft) =>
    leaf.conceptTotal
      ? (remainderAlias.get(leaf.name) ?? leaf.name)
      : leaf.name;

  const leafNames = new Set<string>();
  const conceptLeafNames = new Set<string>();
  for (const period of resolved.values()) {
    for (const leaf of period.leaves) {
      const name = displayName(leaf);
      leafNames.add(name);
      if (leaf.conceptTotal) conceptLeafNames.add(name);
    }
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
      if (
        leaf.nested &&
        !leaf.conceptTotal &&
        !nestedGroup.has(displayName(leaf))
      ) {
        nestedGroup.set(displayName(leaf), leaf.group);
      }
    }
  }

  const segments: StackSegment[] = [...leafNames].map(name => ({
    name,
    group: conceptLeafNames.has(name) ? name : (nestedGroup.get(name) ?? name),
    nested: nestedGroup.has(name) && !conceptLeafNames.has(name),
    conceptTotal: conceptLeafNames.has(name),
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
    const periodLeaves: PeriodLeaf[] = (period?.leaves ?? []).map(leaf => ({
      name: displayName(leaf),
      group: leaf.conceptTotal ? displayName(leaf) : leaf.group,
      nested: leaf.nested && !leaf.conceptTotal,
      value: leaf.value,
    }));
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

function tolerance(value: number): number {
  return Math.max(SUM_ABS_TOLERANCE, Math.abs(value) * SUM_REL_TOLERANCE);
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
