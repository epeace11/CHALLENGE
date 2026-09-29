// One page that grows: the sentence stays on top, the drafted rules appear under it as full cards, and the question is answered on its card.
'use client';
import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  Card,
  EmptyState,
  GlassCard,
  Item,
  Presence,
  useReducedMotion,
} from '@/components/next/ui';
import { DraftingCards, Sentence } from './drafting';
import { EditSheet } from './edit-sheet';
import { RuleCard } from './rule-card';
import { Title } from './title';
import { useSay, type Stage } from './use-say';
import { Example, RulesBox } from './write';

/** Say your rules, version 1. */
export default function SayV1() {
  const say = useSay();
  const { world, draft, stage, rules } = say;
  const still = useReducedMotion();
  const title = useRef<HTMLHeadingElement>(null);
  const rulesHeading = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const draftButton = useRef<HTMLButtonElement>(null);
  const last = useRef<Stage>(stage);

  // Keyboard and screen reader users follow the page: to the rules once drafted, back to the box
  // after Cancel, and to the title after Start over.
  useEffect(() => {
    const from = last.current;
    last.current = stage;
    if (from === stage) return;
    if (stage === 'check') rulesHeading.current?.focus({ preventScroll: true });
    else if (stage === 'write' && from === 'drafting')
      box.current?.querySelector('textarea')?.focus();
    else if (stage === 'write') title.current?.focus();
  }, [stage]);

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
    <PlainFrame back={{ to: 'start' }}>
      <div className="flex flex-col gap-8 pb-4">
        <Title
          ref={title}
          title="Say your rules"
          detail="Say what you both want, in your own words. You check every rule before anything starts."
        />

        {stage !== 'check' ? (
          <div className="flex flex-col gap-4">
            <GlassCard className="nx-enter flex flex-col gap-5">
              {stage === 'write' ? (
                <RulesBox
                  ref={box}
                  value={say.text}
                  onChange={say.typeText}
                  error={say.error}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-nx-2 font-semibold text-nx-ink">
                    Your rules
                  </p>
                  <Sentence text={say.text} rules={draft.rules} lit={say.lit} />
                </div>
              )}
              {/* The example goes once it is in the box. */}
              {stage === 'write' && say.text !== draft.sentence && (
                <Example
                  sentence={draft.sentence}
                  onUse={() => {
                    say.fillExample();
                    // The example card goes away, so focus moves on to the next step.
                    draftButton.current?.focus();
                  }}
                />
              )}
              <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
                <Button
                  ref={draftButton}
                  variant="primary"
                  size="lg"
                  icon={Sparkles}
                  loading={stage === 'drafting'}
                  onClick={say.startDrafting}
                >
                  Draft my rules
                </Button>
                {stage === 'drafting' && (
                  <Button variant="quiet" onClick={say.cancelDrafting}>
                    Cancel
                  </Button>
                )}
              </div>
            </GlassCard>
            {stage === 'drafting' && (
              <DraftingCards count={Math.max(1, say.lit)} />
            )}
          </div>
        ) : (
          <>
            <Card pad="sm" className="nx-enter flex flex-col gap-1.5">
              <p className="text-nx-2 font-semibold text-nx-ink">
                What you said
              </p>
              <Sentence text={say.text} rules={[]} quiet />
            </Card>
            <section
              aria-labelledby="say-rules-heading"
              className="flex flex-col gap-4"
            >
              <h2
                id="say-rules-heading"
                ref={rulesHeading}
                tabIndex={-1}
                className="nx-section-title nx-enter outline-none"
              >
                Your rules
              </h2>
              {rules.length === 0 ? (
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
                <div className="relative flex flex-col gap-3">
                  <Presence mode="popLayout" initial={false}>
                    {rules.map((rule, i) => (
                      <Item key={rule.id}>
                        <div
                          className="nx-enter"
                          style={{ ['--nx-i' as string]: i + 1 }}
                        >
                          <RuleCard
                            world={world}
                            draft={draft}
                            rule={rule}
                            answer={say.answers[rule.id]}
                            error={
                              say.missing === rule.id
                                ? 'Pick one to use these rules.'
                                : null
                            }
                            onAnswer={(option) => say.answer(rule.id, option)}
                            onEdit={() => say.openEdit(rule)}
                            onRemove={() => say.remove(rule.id)}
                          />
                        </div>
                      </Item>
                    ))}
                  </Presence>
                </div>
              )}
            </section>
          </>
        )}

        <p className="sr-only" aria-live="polite">
          {stage === 'drafting'
            ? 'Drafting your rules.'
            : stage === 'check'
              ? 'Your rules are ready to check.'
              : ''}
        </p>
      </div>

      {stage === 'check' && rules.length > 0 && (
        <ActionBar>
          <Button variant="primary" full onClick={acceptRules}>
            Use these rules
          </Button>
          <Button variant="quiet" onClick={say.startOver}>
            Start over
          </Button>
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
      />
    </PlainFrame>
  );
}
