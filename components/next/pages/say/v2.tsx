// Two screens with a glide: write on the first; on the second the question comes first, then the rules as short rows you tap to edit or remove.
'use client';
import { useEffect, useRef } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  Card,
  EmptyState,
  GlassCard,
  Glide,
  Item,
  Presence,
  useReducedMotion,
} from '@/components/next/ui';
import { cx } from './cx';
import { GROUP_ICON, factsParts, keepTogether } from './draft';
import { DraftingCards, Sentence } from './drafting';
import { EditSheet } from './edit-sheet';
import { QuestionChoice } from './options';
import { Title } from './title';
import { useSay, type Stage } from './use-say';
import { Example, RulesBox } from './write';

/** Say your rules, version 2. */
export default function SayV2() {
  const say = useSay();
  const { world, draft, stage, rules } = say;
  const still = useReducedMotion();
  const screen = stage === 'write' ? 'write' : 'check';
  const title = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<Stage>(stage);

  // Keyboard and screen reader users land on each screen's title, or back in the box after Cancel.
  useEffect(() => {
    const from = last.current;
    last.current = stage;
    if (from === stage) return;
    if (stage === 'drafting') title.current?.focus({ preventScroll: true });
    else if (stage === 'write' && from === 'drafting')
      box.current?.querySelector('textarea')?.focus();
    else if (stage === 'write') title.current?.focus();
  }, [stage]);

  // The one question the draft asks back, shown first while its rule is still there.
  const question = draft.questions.find(
    (q) =>
      rules.some((r) => r.id === q.ruleId) &&
      say.answers[q.ruleId] !== 'custom',
  );
  const questionRule = question && rules.find((r) => r.id === question.ruleId);

  const acceptRules = () => {
    const ruleId = say.acceptRules();
    if (!ruleId) return;
    const el = document.getElementById(`question-${ruleId}`);
    el?.scrollIntoView({
      block: 'center',
      behavior: still ? 'auto' : 'smooth',
    });
    el?.querySelector('input')?.focus({ preventScroll: true });
  };

  return (
    <PlainFrame back={{ to: 'start' }} width="narrow">
      <Glide id={screen} direction={screen === 'write' ? -1 : 1}>
        {screen === 'write' ? (
          <div className="flex flex-col gap-6 pb-4">
            <Title
              ref={title}
              title="Say your rules"
              detail="Say what you both want. You check the rules before anything starts."
            />
            <Example
              sentence={draft.sentence}
              onUse={say.fillExample}
              className="nx-enter"
            />
            <RulesBox
              ref={box}
              value={say.text}
              onChange={say.typeText}
              error={say.error}
              rows={6}
            />
            <Button
              variant="primary"
              size="lg"
              full
              icon={Sparkles}
              onClick={say.startDrafting}
            >
              Draft my rules
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pb-4">
            <Title ref={title} title="Check your rules" />
            <Card pad="sm">
              <Sentence
                text={say.text}
                rules={draft.rules}
                lit={stage === 'drafting' ? say.lit : 0}
                quiet
              />
            </Card>

            {stage === 'drafting' ? (
              <DraftingCards count={Math.max(1, say.lit)} compact />
            ) : rules.length === 0 ? (
              <GlassCard>
                <EmptyState
                  icon={Sparkles}
                  title="No rules left"
                  action={
                    <Button variant="primary" onClick={say.startOver}>
                      Start over
                    </Button>
                  }
                />
              </GlassCard>
            ) : (
              <>
                {question && questionRule && (
                  <QuestionChoice
                    id={`question-${question.ruleId}`}
                    className="nx-enter"
                    kicker={`About “${questionRule.title}”`}
                    question={question}
                    value={say.answers[question.ruleId]}
                    onAnswer={(option) => say.answer(question.ruleId, option)}
                    error={
                      say.missing === question.ruleId
                        ? 'Pick one to use these rules.'
                        : null
                    }
                    size="lg"
                  />
                )}
                <section
                  aria-label="Your rules"
                  className="relative flex flex-col gap-2.5"
                >
                  <Presence mode="popLayout" initial={false}>
                    {rules.map((rule, i) => (
                      <Item key={rule.id}>
                        <div
                          className="nx-enter"
                          style={{ ['--nx-i' as string]: i + 1 }}
                        >
                          <DraftRow
                            rule={rule}
                            facts={factsParts(world, rule, say.isOpen(rule.id))}
                            onClick={() => say.openEdit(rule)}
                          />
                        </div>
                      </Item>
                    ))}
                  </Presence>
                </section>
              </>
            )}
            <p className="sr-only" aria-live="polite">
              {stage === 'drafting'
                ? 'Drafting your rules.'
                : 'Your rules are ready to check.'}
            </p>
          </div>
        )}
      </Glide>

      {(stage === 'drafting' || (stage === 'check' && rules.length > 0)) && (
        <ActionBar>
          <Button
            variant="primary"
            full
            loading={stage === 'drafting'}
            onClick={acceptRules}
          >
            Use these rules
          </Button>
          {stage === 'drafting' ? (
            <Button variant="quiet" onClick={say.cancelDrafting}>
              Cancel
            </Button>
          ) : (
            <Button variant="quiet" onClick={say.startOver}>
              Start over
            </Button>
          )}
        </ActionBar>
      )}

      <EditSheet
        world={world}
        open={say.edit.open}
        value={say.edit.value}
        rule={say.edit.rule}
        onOpenChange={say.closeEdit}
        onChange={say.changeEdit}
        onSave={say.saveEdit}
        onRemove={say.remove}
      />
    </PlainFrame>
  );
}

/** One drafted rule as a short row: its name and facts on one line. Opens the editor. */
function DraftRow({
  rule,
  facts,
  onClick,
}: {
  rule: Rule;
  facts: { text: string; pending?: boolean }[];
  onClick: () => void;
}) {
  const Icon = GROUP_ICON[rule.group];
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className="nx-glass nx-tappable nx-row"
      onClick={onClick}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent-strong"
        aria-hidden="true"
      >
        <Icon size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-nx-body font-semibold text-nx-ink">
          <span className="sr-only">Edit </span>
          {keepTogether(rule.title)}
        </span>
        <span className="text-nx-2 text-nx-ink-2">
          {/* Each fact stays whole; a line breaks only after a dot. */}
          {facts.map((f, i) => (
            <span key={i}>
              <span className="whitespace-nowrap">
                <span
                  key={f.text}
                  className={cx(
                    'nx-fade-in',
                    f.pending && 'font-semibold text-nx-wait',
                  )}
                >
                  {f.text}
                </span>
                {i < facts.length - 1 ? ' ·' : ''}
              </span>
              {i < facts.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      </span>
      <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
    </button>
  );
}
