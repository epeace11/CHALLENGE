'use client';
import { useState } from 'react';
import { useNav } from '@/components/next/nav';
import { useToast } from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import { inviteView, topicLabel, type Topic } from './invite-data';

/** The sheets an invite can open. Only one is open at a time. */
export type InviteSheet = 'rule' | 'dates' | 'gift' | 'how' | 'suggest';

export type Suggestion = { topic: Topic; about: string; text: string };

/**
 * Everything the three invite versions share: the data, which sheet is open, the one suggestion
 * Jordan can send Maya, and where Accept and Switch account lead. Versions differ only in layout.
 */
export function useInvite() {
  const world = useWorld();
  const view = inviteView(world);
  const { navigate } = useNav();
  const toast = useToast();
  const [sheet, setSheet] = useState<InviteSheet | null>(null);
  // The rule in the rule sheet, kept after it closes so the sheet keeps its content while it falls.
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic>('other');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Suggestion | null>(null);

  const c = view.challenge;
  const rule = c.rules.find((r) => r.id === ruleId) ?? null;

  return {
    ...view,
    sheet,
    open: (next: InviteSheet) => setSheet(next),
    close: () => setSheet(null),
    rule,
    openRule: (id: string) => {
      setRuleId(id);
      setSheet('rule');
    },
    topic,
    setTopic: (next: Topic) => {
      setTopic(next);
      setError(null);
    },
    draft,
    setDraft: (text: string) => {
      setDraft(text);
      setError(null);
    },
    error,
    /** Opens Suggest a change, on `about` when it comes from a rule or a setting. */
    suggest: (about?: Topic) => {
      if (about) setTopic(about);
      setError(null);
      setSheet('suggest');
    },
    send: () => {
      const text = draft.trim();
      if (!text) {
        setError('Write what you would like instead.');
        return;
      }
      const suggestion = { topic, about: topicLabel(c, topic), text };
      setSent(suggestion);
      setDraft('');
      setSheet(null);
      toast({
        text: `Sent to ${view.inviter.name}`,
        action: {
          label: 'Undo',
          onClick: () => {
            setSent(null);
            setDraft(text);
          },
        },
      });
    },
    sent,
    takeBack: () => {
      if (sent) setDraft(sent.text);
      setSent(null);
    },
    accept: () => navigate('pact'),
    switchAccount: () => navigate('signup'),
    signOut: () => navigate('landing'),
  };
}

export type InviteFlow = ReturnType<typeof useInvite>;
