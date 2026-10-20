'use client';
import { openDay } from '@/lib/next/selectors';
import { draftCap, draftDays } from './draft';
import { RuleBuilderSheet } from './builder-sheet';
import { LibrarySheet } from './library-sheet';
import { DeadlineSheet, TimeZoneSheet } from './sheets';
import { StakesHowSheet } from './stakes';
import type { Setup } from './use-setup';

/** Every sheet versions 2 and 3 open: time zone, deadline, how the gift adds up, the library, the builder. */
export function SetupSheets({ setup }: { setup: Setup }) {
  const { world, draft, patch, sheet } = setup;
  return (
    <>
      <TimeZoneSheet
        {...sheet('zone')}
        value={draft.timeZone}
        detected={world.challenge.timeZone}
        now={world.now}
        onSave={(timeZone) => patch({ timeZone })}
      />
      <DeadlineSheet
        {...sheet('deadline')}
        value={draft.deadline}
        onSave={(deadline) => patch({ deadline })}
      />
      <StakesHowSheet
        {...sheet('how')}
        step={draft.step}
        cap={draftCap(draft)}
        stakes={setup.stakes}
        people={setup.people}
        days={draftDays(draft)}
      />
      <LibrarySheet
        {...sheet('library')}
        library={world.library}
        rules={draft.rules}
        onToggle={setup.toggleLibrary}
      />
      <RuleBuilderSheet
        {...sheet('builder')}
        rule={setup.editing}
        rules={draft.rules}
        me={world.me}
        partner={world.partner}
        day={openDay(world) ?? world.today}
        onSave={setup.builderSaved}
      />
    </>
  );
}
