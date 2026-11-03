import type { Challenge, PracticeScript, Rule } from './model.ts';
import { formatNumber } from './format.ts';
import { rulesFor } from './selectors.ts';

/**
 * The practice day from a couple's own rules: three of yours to answer (a Yes or No left for you,
 * an answer your partner disputes, and a miss) and two of your partner's to review (a Yes, and a
 * number its screenshot doesn't back). A part their rules can't play takes the sample's (`sample`).
 */

/**
 * What a practice screenshot can show for a number rule: a step count, or screen time kept under a
 * limit. Other numbers (calories, pages) are answered without one in practice.
 */
export function shotKind(rule: Rule): 'steps' | 'screen' | null {
  const t = rule.target;
  if (rule.kind !== 'number' || !t) return null;
  if (t.unit === 'steps' && t.op === '>=') return 'steps';
  if (t.unit === 'min' && t.op === '<=') return 'screen';
  return null;
}

/** "1h 12m", "47m": as a phone's screen-time page says it. */
const hm = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;

/** A number that meets the target with room to spare, and one its screenshot shows instead, off target. */
function claim(rule: Rule) {
  const t = rule.target!;
  if (shotKind(rule) === 'steps')
    return { value: t.value + 200, shot: Math.round(t.value * 0.8412) };
  if (shotKind(rule) === 'screen')
    return { value: Math.round(t.value * 0.75), shot: t.value + 12 };
  return { value: t.value, shot: undefined };
}

/** A number that misses the target. */
const missing = (rule: Rule) =>
  rule.target!.op === '>='
    ? Math.round(rule.target!.value * 0.6)
    : Math.round(rule.target!.value * 1.5);

/** What the pretend partner says about an answer its screenshot doesn't back. */
function disputeOf(rule: Rule, shot: number | undefined) {
  if (shot !== undefined && shotKind(rule) === 'screen') {
    const social = Math.round(shot * 0.65);
    return `Your screenshot: social ${hm(social)}, games ${hm(shot - social)}. That’s ${hm(shot)}.`;
  }
  if (shot !== undefined)
    return `Your screenshot says ${formatNumber(shot)} steps.`;
  return 'Are you sure? That’s not what you told me.';
}

/** A practice copy of a rule: a screenshot only where practice can draw one. */
const forPractice = (rule: Rule): Rule =>
  rule.proof === 'none' || shotKind(rule) ? rule : { ...rule, proof: 'none' };

export function practiceFor(
  c: Challenge,
  meId: string,
  partnerId: string,
  sample: PracticeScript,
): PracticeScript {
  const used = new Set<string>();
  /** The first rule that fits, trying each test in turn; one already used only with `reuse`. */
  const pick = (
    rules: Rule[],
    fits: ((r: Rule) => boolean)[],
    reuse = false,
  ) => {
    for (const fit of fits) {
      const r = rules.find((x) => fit(x) && (reuse || !used.has(x.id)));
      if (r) {
        used.add(r.id);
        return forPractice(r);
      }
    }
    return null;
  };
  const yesNo = (r: Rule) => r.kind === 'yesno';
  const plainYesNo = (r: Rule) => yesNo(r) && r.proof === 'none';
  const number = (r: Rule) => r.kind === 'number' && !!r.target;
  const drawn = (r: Rule) => !!shotKind(r);
  const mine = rulesFor(c, meId),
    theirs = rulesFor(c, partnerId);

  // Yours: a Yes or No left for you (a plain Yes saves on tap), then an answer your partner disputes,
  // then a miss.
  const [first, second, third] = sample.questions;
  const open = pick(mine, [plainYesNo, yesNo]);
  const doubted = pick(mine, [drawn, number, yesNo]);
  const missed = pick(mine, [yesNo, number]);
  const disputed = doubted
    ? number(doubted)
      ? { rule: doubted, ...claim(doubted) }
      : { rule: doubted, value: undefined, shot: undefined }
    : null;
  const questions: PracticeScript['questions'] = [
    open ? { rule: open, sample: {} } : first,
    disputed
      ? {
          rule: disputed.rule,
          sample:
            disputed.value === undefined
              ? { done: true }
              : { value: disputed.value },
          ...(disputed.shot !== undefined ? { shot: disputed.shot } : {}),
        }
      : second,
    missed
      ? {
          rule: missed,
          sample: number(missed) ? { value: missing(missed) } : { done: false },
        }
      : third,
  ];
  const sampleDispute = sample.partnerReview.find(
    (r) => r.decision === 'dispute',
  );

  // Theirs, for you to review: a Yes, then a number its screenshot doesn't back. Rules you just
  // answered come up again only when there are no others.
  const [theirYes, theirNumber] = sample.partnerAnswers;
  const said = pick(theirs, [yesNo]) ?? pick(theirs, [yesNo], true);
  const claimed = pick(theirs, [drawn]) ?? pick(theirs, [drawn], true);
  return {
    questions,
    partnerReview: [
      { ruleId: questions[0].rule.id, decision: 'approve' },
      {
        ruleId: questions[1].rule.id,
        decision: 'dispute',
        comment: disputed
          ? disputeOf(disputed.rule, disputed.shot)
          : sampleDispute?.comment,
      },
    ],
    miss: { ruleId: questions[2].rule.id, cost: c.step },
    partnerAnswers: [
      said ? { rule: said, answer: { done: true } } : theirYes,
      claimed
        ? (() => {
            const { value, shot } = claim(claimed);
            return { rule: claimed, answer: { value }, shot };
          })()
        : theirNumber,
    ],
  };
}
