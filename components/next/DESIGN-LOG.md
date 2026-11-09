# Design log

Erin picks one version of every page at `/preview` with the 1 2 3 buttons. Write the pick and a short reason under the page; once a page is picked, the other versions are deleted from `components/next/pages/<page>/` and the pick becomes the page.

## Decisions, November 5, 2026 (ninth audit and eighth critique, and everything they found)

Erin asked to rerun both after the last round of fixes. The audit came back 14/20 with no critical issues and one major one (from one critical and five major), and the critique 29/40 (trend 27, 29, 30, 28, 29). Of the last round's six fixes, two fully held and four partly did. All of it is fixed here.

What would have gone wrong in real use:

- **The page still froze on each load.** Three-quarters of the time went on building a date formatter thousands of times. Each time zone now keeps one.
- **Settling gave the result away.** Overview said "see who won" above the gift amounts, who's ahead, and the week. After the last day it now shows only what's left to settle.
- **Settling's signposts pointed the wrong way.** Disputes now come first in Review while settling, Review's tab counts every open dispute, and when only a dispute you raised or replied to is left, Review says so and opens it instead of "All caught up".
- **Review cropped the proof.** The screenshot on the card is now shown whole, and a little taller on phones.
- **A second challenge before a partner joined shared the first one's invite.** It now gets its own, and the Shared page asks who it's with as Start does.
- **A saved copy went by its name,** so renaming could lose it or change another copy with the same name. It now knows its challenge (`saved-copies.sql`), and it shows the partner it was saved with.
- **A hidden challenge could still be opened** through its verdict or saved copy, and "See how it ended" could open the wrong one.
- **A draft your partner is setting up looked like yours.** It now says "Jordan is setting this up", asks nothing of you, and never opens by itself.

From the critique:

- **Another challenge's result can't be missed.** A finished challenge that isn't on screen gets a row on Overview for two weeks, or until the gifts are given. Rows on Overview name the partner.
- **The challenge's name shows it can be switched** when there are others, and the end of Check in goes on to another challenge that's waiting.
- **Your limit starts empty,** with the suggestion beside it, and says your partner sees it.
- **Smaller:** one filled button on Your challenges, "That was the last day." on Check in, Settings' account tab is titled "For every challenge", Start says "You'll invite them once it's set up", the recap sheet no longer points to reminders that aren't built, and Undo takes focus once.

Kept on purpose: the detector flags the small tiles inside Your challenges' cards as nested cards. They are tappable numbers inside one challenge, so they stay.

## Decisions, November 5, 2026 (eighth audit and seventh critique, and everything they found)

Erin asked for a final audit and critique before the run-through. They were the first to look at the several-challenges, settling and hide work, and both went down: the audit 14/20 (from 16) and the critique 28/40 (from 30), trend 26, 27, 29, 30, 28. The audit said not to start the real challenge until its one P0 and five P1s were fixed. They are; those scores were taken before these fixes. Run `supabase/next/fixes-nov-5.sql` on PROD CHALLENGE before deploying.

What would have gone wrong in real use:

- **A dispute could get stuck for ever (the P0).** Once a dispute was replied to, the person who raised it could neither see it nor withdraw it, so with "must be settled" a challenge could never finish. Everyone who raised a dispute now finds it, with the reply and Withdraw, in the Waiting list on Review, replied to or not.
- **Delete for good left the challenge on screen,** and hiding your last challenge took away Your challenges, so Restore was out of reach. A hidden or deleted challenge is now never the one on screen, and with nothing on screen Your challenges still opens when anything is hidden or saved.
- **An invite link locked out a signed-in person** with challenges of their own: the invite page was the only page. It now has Not now.
- **Run it again and shared links could start with the wrong partner, or overwrite a draft.** A saved challenge now remembers its couple, starting from one never replaces a challenge being set up, and Set up says who it's with.
- **The page froze every minute** once there was a finished challenge (about half a second each on a laptop, more on a phone). A finished challenge's numbers are now worked out once per load, and looking up an answer no longer scans the whole list.

From the critique:

- **Laptops never showed the challenge's name** (the tabs squeezed it to nothing). From 1024px the name and day have a row above the tabs.
- **The dot is gone.** It sat beside the wrong challenge and didn't say what it meant. Overview now says it in words, "Morning Walks · Day 6 of 30 · 1 left to log", and tapping opens that challenge. Your challenges shows every running challenge the same way, what waits on you first, with the filled button on the first.
- **The settling screen is kinder and clearer.** It opens "You finished Fall Reset", then "Settle 1 dispute to see who won.", then says what you can do: "You can concede it, or Jordan can withdraw it." It replaces the day's card, so there's one main action. Once settled, Overview and Review lead to See who won. See it at `/preview?page=overview&settling`.
- **Start asks "Who's it with?"** in words, as chips with avatars that wrap for any number of partners; Someone new says "You'll send them an invite after you sign."
- **Hide leaves a trace:** "Summer Sprint hidden" with Undo where the card was, and focus on Undo. Share link moved into the rules sheet, so finished cards are shorter.
- **Settings:** the tabs are This challenge and Your account. Export moved to This challenge, since it only covers that one. The preview now shows only what ships, so reminders and proposing changes are gone from it until they're built.
- **The limit step** says "This or less, each day it's asked." **Practice** offers "Dispute it instead" after you approve the mismatched answer.

Also fixed: a late answer on an unreviewed day no longer holds up the result for ever, and a saved copy follows a rename (both in the script); the verdict opens the challenge on screen, not simply the newest; hidden saved ones stay off Start; one challenge failing to sync no longer stops the others loading; deleting pages through all of a challenge's screenshots.

- **For later:** erasing can't retry if it fails partway (rows stay, invisible to both); each load still fetches everything; Progress's habit bars rest on colour with no number beside them; Landing is the least specific page; a saved challenge's sheet on Start still names the partner it was saved with; a hidden card leaves without an animation; on a 1280×800 laptop Review's screenshot is partly under the pinned bar.
- **Questions from the critique:** should each person see the other's limit before signing, since neither can change it after? With several challenges, should there be one "today" across all of them?

## Decisions, November 4, 2026 (deleting a challenge, and which settings are which)

Erin: "You should be able to fully delete a challenge, and it should not log the money on your challenges page. Also, it's not clear that the settings are for that challenge. I want it to be very obvious what settings are overarching and what settings are for each challenge." Then, on who a delete affects: "it should only delete from the person who deleted it. or it should go into hidden then you can fully delete from hidden like an archive, but it would only be within yours". Run `supabase/next/hide-challenges.sql` on PROD CHALLENGE before deploying.

- **Hiding and deleting are each person's own.** A finished challenge or a saved one has Hide on its card on Your challenges (and a finished one, "Hide this challenge" in its Settings). It moves to a Hidden row at the bottom of the page, only on that person's account; there's no pop-up, and it can come back with Restore. From Hidden, Delete for good takes it off their account, with a sheet saying "Jordan keeps theirs". The partner's copy never changes, so nobody can wipe a result to get out of a gift. It's only erased, with every answer, screenshot, point and gift, once neither person has it.
- **A running challenge has to end first,** because ending takes both. Before Day 1, "Delete this challenge" still deletes it for both people: nothing has counted, and it's the only copy.
- **Settings has two tabs, This challenge and All challenges,** so only one group is on screen and neither can be mistaken for the other. Each opens with a heading that says what it's for: "Fall Reset. With Jordan. These are for this challenge only." and "Your account. These apply to all your challenges." This challenge has its name, its rules and stakes, and ending or deleting it; All challenges has your name, appearance, export and sign out. With several challenges, Switch challenge goes to Your challenges.
- **A challenge can be renamed** in the live app, at any time, from its Settings.

## Decisions, November 4, 2026 (Erin's launch answers: settle everything now)

Erin: "Things should not wait till after we start. We're settling everything now." Run `supabase/next/settle-and-many.sql` on PROD CHALLENGE before deploying.

Erin's calls:

- **The next challenge runs on the test address**, test.thechallenge.win.
- **Pinch-zoom stays blocked.** The final result keeps leading with the winner. Check in doesn't offer "All yes except…". Deadlines don't show a time zone.
- **Disputes must be settled, and nothing ends without it.** After the last deadline a challenge stays open, with no result, until every dispute is settled (the person who answered concedes, or the person who disputed it withdraws). It also waits for every answer to be reviewed, 48 hours at most, since a last-day answer could otherwise never be disputed; once it's finished, nothing can be disputed. Overview says what's left ("Settle 1 dispute to see who won"). Ending early is refused with a dispute open: the sheet says "Settle 1 dispute first" with Go to Review. When both agree to end early, answers still waiting for review stand. If nobody settles, there's no result; that's the rule.
- **Several challenges at once, with the same partner or different ones.** The one-at-a-time limit is gone (it was there because the app could only show one, so a second hid the first while it kept adding misses). Start asks who it's with: each partner, or Someone new. Your challenges lists them all with where each stands ("Day 6 of 30 · 1 left to log", "Sign the pact"), and Open challenge switches to one; the app comes back to the last one opened on that device. A dot beside the challenge's name at the top says another one is waiting on you. A person can be in several couples, and each partner only ever sees their own challenge. Someone invited who's already your partner stays one couple. Accepting an invite no longer deletes a challenge you were setting up with someone else.

Not checked in the live app: everything above was tested in the database tests and the preview, not with real accounts.

## Decisions, November 3, 2026 (the last leftovers, then a seventh audit and sixth critique)

Erin: fix the three leftovers, then audit and critique again. The audit scored 16/20 again, now covering the pact, limit and Practice changes; the critique 30/40 (trend 28, 26, 27, 29, 30; `.impeccable/critique/`). Everything both found was fixed except what's listed for Erin below.

The leftovers:

- **A failed dispute, reply or forgiveness ask on Review keeps its words.** Review's decisions now wait for the write: if it fails, the card comes back without its stamp and its sheet opens with what was typed.
- **Nothing is cut off at 150% text zoom (260px).** The top bar's account chip goes under Back, button labels wrap under 320px, Your challenges' column shrinks, Check in's day reads "Thu 19" under 360px and is never cut off, and the tab bar shows icons only under 320px (labels still read out). All 19 pages fit at 260 and 320px.
- **The animation code loads after the page.** The kit uses Motion's light `m` component (the kit's `motion` is it), and the animation features load in a chunk of their own as the kit loads in the browser (retried once). Only in the browser: starting that load at the top of the module on the server hung the whole Worker on Cloudflare, though not in `wrangler dev`, so the test site went down until it was rolled back and fixed. After a deploy, always load `/preview` and `/app` on the test site. The kit's chunk went from 114 KB to 89 KB gzipped. The EXIF reader loads only when a screenshot is added: the live app's first download went from 91 KB to 66 KB gzipped.

From the critique:

- **The limit step says it's final:** "Jordan sets their own. Yours can't change after you sign." The signature step and the Sign sheet repeat "Your limit: 1,800 kcal or less."
- **Practice's review teaches:** approving Jordan's 10,200 steps against a screenshot of 8,412 now says "Its screenshot says 8,412 steps. On Review, that's one to dispute." with Next, instead of moving on.
- **Check in's Save stays in one place** on every question: its bar is pinned to the bottom of the screen (`ActionBar pinned`), with a space of its height where it was.
- **Number fields have no placeholder "0"**, which read as an answer.
- **The setter-up's pact:** their own signature line is first, after signing it says "Now invite Jordan to sign." until Jordan has joined, and a Day 1 moved past the planned day says "The day after you both sign".
- **Your own dispute is in the waiting colour** with a question mark (it's being talked about), not the missed red and warning triangle.
- **Review's "All caught up" fits** at 390×844.

From the audit:

- **Scrolling never waits for script:** the page-wide touchmove listener is gone (pinch stays blocked by the viewport, `touch-action` and the iOS gesture block; sheets lock the page behind them themselves).
- **The sign-in code field has the 3:1 input edge** (`field-line`), like every other field.
- **Windows High Contrast** draws the switch, the chosen segment and the bars in system colours. In dark, the page's own scrollbar is dark, and the tab bar's shadow is a token.
- **Choosing a new password** says "Couldn't save. Check your connection." when offline instead of the raw error.

- **For Erin:**
  - **Pinch-zoom.** The audit's one P1 again: blocking it fails WCAG 1.4.4 as axe and Lighthouse apply it. Allowing it would keep double-tap zoom off (`touch-action: manipulation`). It's your call; it stays blocked.
  - **The verdict.** Should it lead with what you did together ("21 of 21 days, both of you"), with the winner second?
  - **Open disputes.** An open dispute is never a point, and only the person disputed can concede (the "free veto"): should one still open at the end count, or settle after a few days?
  - **Several Yes answers at once.** Most days are mostly plain Yes. Should Check in offer "All yes except…"?
  - **Practice's second question.** It starts filled in (45 min with a screenshot) and is then disputed. Should it start empty?
- **For later:** the setter-up's invite-link screen exists only in the live app (the preview's "Invite Jordan" opens Jordan's side). On a 1280×800 laptop, Review's screenshot is partly under the pinned bar. Day squares are 37–39px at 320px (they pass WCAG's 24px but not Kazzy's 44).

## Decisions, November 3, 2026 (Erin's answers to the last six questions)

Erin's answers: a gym No doesn't save on tap (forgiveness should stay possible); Day 1 after late signing was left to the recommendation; Practice uses the couple's own rules; the person who sets it up reads the pact before signing; there is a place for each person's own limit on Fitness & Food; the card blur was left to the recommendation. Run `supabase/next/pact-limits.sql` on PROD CHALLENGE before deploying.

- **A gym No still waits for Save,** like every No. A No on one day costs nothing; a week short of its target is a point on the week's last night, and Review's "Ask Jordan to forgive a point" lists it, so it can be forgiven.
- **Day 1 is never before the day after both sign.** Signing on or after the planned first day moves Day 1 to the next day (it used to make the signing day itself Day 1, a day already under way). Before both have signed, the pact, the invite and Your challenges show the day it will be if they sign today (`asIfSignedToday`).
- **The person who sets it up reads the pact and signs it,** like their partner. Set up's last button is "Read the pact" (was "Invite Jordan", which signed for them); the pact opens from their side with both lines empty, and after signing its button is "Invite Jordan" (the invite link page), or "Go to Your challenges" when the partner is already in and still to sign. Back on its first step returns to Set up. Your challenges says "Sign the pact" until they have. In the preview, Set up's "Read the pact" opens the pact on the challenge as drafted.
- **Each person sets their own limit when they sign.** A rule like "Stay under your calorie limit" adds a step before the signature, "Your limit" (Step 3 of 4): a number field starting at the suggested 2,000 kcal, "Jordan sets their own." under it, and "Enter your limit." if it's left empty. The limit is saved with the signature and can't change after; changing the rules before Day 1 clears both signatures, so both sign (and set it) again. Check in checks your answer against your own limit and Review checks the partner's against theirs. The Rules page lists "Your limit" and "Jordan's limit", and the pact's rule sheet says "Each of you sets your own" (with Jordan's once Jordan has signed). In the preview, add "Stay under your calorie limit" in Set up's rule library to see the step.
- **Practice uses the couple's own rules** (`practiceFor` in `lib/next/practice.ts`). It picks three of yours: a plain Yes or No to answer, an answer the pretend partner disputes, and a miss. It picks two of your partner's to review: a Yes, and a number its screenshot doesn't back. The disputed answer is a step count or screen time when the couple has one, since practice can draw those screenshots; another number is answered without one ("Are you sure? That's not what you told me."). A part their rules can't play uses the sample's. The sample couple's practice is their own rules already.
- **Cards don't blur what's behind them.** Behind a card is only the page's soft glow, so the 22px blur showed almost nothing and cost smooth scrolling on older phones. The tab bar, the laptop header and the sheet's scrim keep theirs, since content scrolls under them.

## Decisions, November 3, 2026 (Erin's answers, then polish, harden, onboard and speed)

Erin's answers to the fifth critique's questions: a plain Yes saves on tap; Practice rehearses reviewing; Progress doesn't tell someone behind that they can catch up; nobody names their gift yet. Then Impeccable's remaining passes ran (polish, harden, onboard, plus the first-load work the audit held back), each as a review whose findings were checked in the code before fixing.

Erin's calls, built:

- **A plain Yes saves on tap** on Check in: a tap or click on Yes for a rule with no screenshot saves it and the next question glides in. No still waits for Save (a miss can ask to be forgiven), and so do a Yes with a screenshot (required or optional), a Yes with a note just opened, a late answer, and anything chosen with the keyboard: arrow keys and Space only choose, so moving between Yes and No never saves by itself (YesNo's `onTap`). A question ignores Yes and No for its first 350 ms, so a double tap can't answer the next one.
- **Practice rehearses reviewing.** A new step, "Review Jordan's answers", shows two of Jordan's sample answers one at a time with Dispute and Approve pinned, as on Review. The second (10,200 steps against a screenshot of 8,412) is there to dispute; Dispute asks for a reason in the same sheet as Review. Practice's first question starts empty and saves on a tap of Yes, as Check in does.

Practice fits:

- Only the step under way is open; the others are their titles. The practice marker moved into the top bar beside Back ("Practice. Nothing counts."), the saved answers became a bar on the step's row, and on laptops the review's short cards sit two to a row, the screenshot beside the answer, and the gift's amount beside its steps. Every step now fits at 390×904 and at 700×728.
- Save stays filled and, pressed early, says "Choose Yes or No." and goes to the answer, as on Check in. After Jordan's review the button is "Next" (the next step's title says what). A partner who hasn't joined is "Your partner" at the start of a sentence.

Check in fits in its last two scrolling states:

- **A miss:** its card is the cost ("Adds $7 to the gift you give.") and "Ask Jordan to forgive it ›", which opens the reason in a sheet (the kit's new `ReasonSheet`, shared with Review and Practice). With a reason, the card shows "Asking Jordan to forgive it", the reason (tap to change) and Don't ask. An optional screenshot on a miss is a small "Add screenshot" beside "Add a note" instead of a tile.
- **Saving keeps what was typed** until the write lands: a failed save brings the check-in back with its note, screenshots and reason.
- **A screenshot uploading** shows a spinner on its tile, Save waits ("The screenshot is still uploading."), and the tile goes after six (the database's limit).

Faster first load:

- **Each page loads the first time it's shown** (`pages/registry.ts`), and `/app` fetches the rest 1.5 s after its first page is up, so moving between pages never waits. The first load's scripts went from about 1.38 MB to 1.1 MB. A page that is slow to arrive shows a spinner after 300 ms; one that fails to arrive tries again on its next showing.
- **The old app's stylesheets aren't loaded** on this branch (only `shell.css`, `touch.css` and `next.css`), and next.css's block that cancelled them is gone. A sweep of every element on all 19 pages found the same computed styles before and after.

The live app, hardened (`components/live`, `lib/live`):

- **Losing signal no longer looks like being signed out:** a network error keeps what's on screen and tries again, and a failed save says "Couldn’t save. Check your connection." instead of the browser's error.
- **A save never flickers back:** changes still being sent stay on screen through every reload, quick saves in a row reload once, and live updates wait 300 ms and skip while a save is sending.
- **A page that fails** (or whose code can't be fetched after a deploy) shows the Can't load card with Try again, never a blank app.
- **Start, join and accept can't run twice** from a double tap. The clock moves (a tab left open overnight logs the right day), screenshots aren't fetched again on every reload, and the screenshot picker always settles (cancel included).
- **Links:** an expired or used invite says so ("This invite link has expired or was already used. Ask your partner to send a new one.") instead of showing the landing page; a shared link survives a bad connection; the invite screen says when the link couldn't be made, whether the partner has opened it, and offers Try a practice day; after signing up from an invite, Accept isn't needed twice.

Onboarding:

- **Day 1 says when to answer.** Overview's top card on Day 1 is "Nothing to log yet" with "Tomorrow, answer for today by 11:59 pm." and today's check-ins, and its main action is Try a practice day; the zero gifts and "Waiting for you 0" wait until there's something to show. Check in's empty state says the same (and before Day 1, "Day 1 is … On Wednesday, answer for Tuesday by 11:59 pm."). Before Day 1, Overview drops its "Day 1 starts in" tile (the title and the top bar already say it) for that line.
- **The invited partner:** without an account the invite's top bar offers Sign in instead of an account menu, Sign up says "Then sign the pact with Maya.", and after Accept the pact opens on its signature (they've just read the start, stakes and rules on the invite; Back still steps through them).
- **A theme tapped on the landing page** opens on its sheet in Start after sign-up. A brand-new account's Start says "Joining your partner's challenge? Open the invite link they sent you."

Polish and harden, smaller:

- Typed notes, reasons and disputes keep their line breaks, and a pasted link wraps instead of running off.
- A day with none of your check-ins says "Nothing to answer" instead of "All logged" and an empty tally.
- An avatar's initial is a name's first whole character, so a name starting with an emoji keeps it.
- Placeholders reach 4.5:1 in light mode. Practice's answer to review is sans, not bold Georgia, and its question text is 17px.

A sixth audit, after all of this, scored 16/20 (14 before): keyboard and screen readers, every look's contrast in light and dark, and the split pages count for it. Its fixes:

- **The screenshot viewer fits a tall screenshot to the screen** (it was cut off below the screen on phones, and showed at full size on laptops), and zooms with a pinch, a double-tap or the wheel, panning by drag; swiping and pulling down to close work when it isn't zoomed. Page zoom stays blocked, as decided, so this is where zoom lives.
- **Moving to a page whose code hasn't arrived keeps the current page up** until it has, instead of a blank screen; Overview's code is fetched with the data at start-up, and the preview fetches every page too.
- **A sheet stays above a phone's keyboard,** so Dispute, Reply and Ask stay in reach while typing.
- Screen readers hear Copy link's result, and a failed write once, not twice. touch.css lost the old app's selectors and its 16px rule for inputs (every input is 17px from the kit).

Not changed, for later or for Erin:

- **For Erin:**
  - Every glass card has a 22px backdrop blur (DESIGN.md's frosted glass). Behind them is only the page's soft glow, so dropping it would look nearly the same and scroll more smoothly on older phones. Drop it?
  - A weekly No (gym) costs nothing and shows nothing more: should it save on tap like Yes?
  - When the partner opens the invite after the planned start, signing makes Day 1 the signing day; should it be the day after both sign (a database change)?
  - Practice uses the sample rules, not the couple's own; build it from their rules?
  - The person who sets it up signs by tapping Invite your partner, without seeing the pact's terms; show them first?
  - Fitness & Food's "each of you sets your own limit" has nowhere to set it.
- **For later:** deadlines show in the challenge's time zone with no label (a partner in another city reads Toronto's 11:59 pm as theirs); a failed dispute or reply on Review loses its text; "Opened" on the invite screen updates on a reload, not live (the invites table isn't in the realtime publication, a database change); Safari before 16.4 can't tell a cancelled screenshot picker; Motion is loaded whole (about a third of the kit's 112 KB) for a few fades and glides; at 260px (150% zoom on a phone) Start's account chip and a few card rows are cut off rather than reflowing (320px passes).

## Decisions, November 2, 2026 (fifth design critique and audit)

Impeccable's remaining steps ran for the first time: `PRODUCT.md` (from Erin's answers: couples she shares it with register themselves; success is finishing together, having fun and starting another; they open it on a phone whenever they remember) and `DESIGN.md` (the Calm style as built). Then a technical audit scored 14/20 and a fifth critique 29/40 (26, 28, 26, 27, 29). Erin's answers: fix everything both found, keep pinch-zoom blocked, and take the recommendation on the 75-Day colour and on Overview's day.

Erin's calls:

- **Pinch-zoom stays blocked** in the app, as before.
- **The 75-Day look is plum** (`#7c3a8f`, light `#e3a6f0` in dark), not berry: berry sat next to missed red, so "you're ahead" and "Won the week" read like misses.
- **Overview keeps today's date as its title,** and its button says "Log yesterday" (an older open day keeps its weekday); the logged card says "Yesterday is logged".

Keyboard and screen readers (the audit's P1s):

- **A sheet keeps focus inside it:** Tab wraps from its last control to its first, and the page behind it is inert while it's open.
- **Focus never hides under the tab bar, the pinned action bar or the laptop's sticky header:** the frame measures them (`--nx-nav-h`, `--nx-header-h`) and whatever gets focus scrolls clear.
- **After moving to another page, focus starts at its title,** and the live app names the browser tab after the page ("Check in · The Challenge"). Laptops get "Skip to content".
- **A failed write's message is announced at once and stays 8 seconds.** The kit gallery shows that message, not an Undo toast.

Colour and contrast:

- **Day squares look the same in dark as in light:** they end on their own colour instead of fading, so a missed or open square's date and "×1" keep 4.5:1.
- **Inputs, number boxes, the switch when off and the selected segment have a 3:1 edge** (`--nx-field-line`).
- **Fitness's accent is a little deeper** (`#a4470f`), so its text passes on its soft fill.
- **In dark, sheets, menus and bars take the look's own page colour** instead of the classic violet, and the browser's bar colour follows the look and theme.
- **Hold to sign shows its fill** (a light wash over the slate button); with reduced motion it fills in three steps.

The critique's issues:

- **Review's Undo line stays on screen** after a decision made while scrolled: the page scrolls so the line and the next card are both in view, and focus still moves to the next card. Undo's 5 seconds pause while it has focus or the pointer is on it. On phones a card's note comes before its screenshot, so the pinned bar no longer covers it.
- **Check in fits in its common states** (a screenshot added, the "Enter a number" message, a miss): from 640px the screenshot, the week and the miss card sit beside the answer; on phones the screenshot's label hides once one is added; "Changing your saved answer" replaces the group line. Still scrolling: a miss with the forgiveness reason box, and Social media's miss with its screenshot strip (each several fields). The message under Save is now tied to its field for screen readers. "Choose a day" draws the open day as an open square. The journal's Add note stays filled and says why when there is nothing to add.
- **One day sheet on Overview and Progress** (the kit's `DayCheckins`): You and Jordan chips with each person's square and a steady height; each row leads where it can be acted on (your open check-in to Check in, anything waiting on you to Review, your miss to Review with "Ask Jordan to forgive it", the rest to the check-in itself). "1 of 6 missed" is gone (each miss has its pill), and the gym week is the last row of the list ("2 of 4 this week").
- **Money words:** the pact's and Invite's stake sheet is "What a point costs" and ends with how the ~$150 is reached ("If you each miss 1 in 10 check-ins (about 17 points), each gift comes to about $150."). Recap's gifts say "$15 of it last week" (was "Now, up $15 last week") and its notification "This week's plan: gym 4 times each." Progress says "Only Jordan".
- **Start words:** "Run it again" repeats a finished challenge, "Start a new challenge" starts anything new, and a challenge another couple shared says "Use this challenge" (as on Start). Your challenges keeps "Open challenge" for the running one.
- **Smaller fixes:**
  - Badge rows give their total's unit ("18 of 30 days", "10 of 22 Sun–Thu days").
  - Practice's banner has a backing, and its sample dispute matches the screenshot ("social 47m, games 25m. That's 1h 12m.").
  - Start's theme list has one Back ("‹ All ways to start") and sits two to a row from 640px.
  - Progress photo has a camera icon.
  - The verdict's Save for later becomes just its icon when the top bar is too narrow.

Not changed, on purpose or for later:

- **Day squares at 320px** are 37–39px wide; seven across can't reach 44px inside the page margins.
- **The app still loads every page and the old app's styles on first load;** splitting them is left for a performance pass, since it touches how the live app is built.
- **For Erin, from the critique:**
  - Each Yes/No needs its own Save (about 14 taps for 7 rules). Should a plain Yes save on tap?
  - Practice never rehearses reviewing. Should it?
  - Nothing tells the person behind on points that they can still catch up. Should Progress say so?

## Decisions, November 2, 2026 (nothing said twice)

Erin, on Check in's end of the day ("Sunday is logged" under the "Sun, Nov 1" button, and a clock icon on the square and again in the legend): "too much information on this page, the icon should not be there twice, sunday should not be there twice. review the whole app for duplicate information". Every page and sheet was reviewed. Where a screen said the same thing twice, the clearer one stays. It's rule 12 in `README.md`'s checklist.

- **Check in's end of the day:** "All logged" (the button above names the day), and the squares' legend became one line in words, "3 done, 4 waiting for Jordan", before "You can change an answer until…". A Gym question's label is "Movement", since its card says "2 of 4 this week". The miss card says "the gift you give" (the name is in the sentence), and its box is "Your reason". The journal says "No notes yet." and "New note". The "3 left" sheet drops an Open pill under "Left to answer".
- **A day's button says "Log this day"** on Overview's and Progress's day sheets, whose titles name the day. Progress's "Thursday is open until 11:59 pm tonight" beside "Log Thursday" is "Open until 11:59 pm tonight".
- **Overview:** the gift cards drop "From Jordan's 9 points" (the line under them gives both numbers), and "Jordan's answers are next" goes when the button says it. A quote by the person whose chip is chosen doesn't start with their name.
- **Review:** no target line when the rule's name says it ("10,000 steps"); a miss says "Misses the target". "Approve both answers"; the dispute card's button is "Reply", and its gift line drops the name. The reply box has no "Jordan reads exactly what you write" hint under "Reply to Jordan". The Waiting for Jordan list drops its waiting pills; a late answer says "Late answer:".
- **Rules and help:** a rule's sheet has no Days row when its name says the days, and its answer is "A number" when the name has the target. The "What does a point cost?" answer is gone (the "What a point costs" row says it); its "Your 6 points … = $21" link moved into the gift answer.
- **Progress:** a check-in no longer shows "Yes" beside Done. A badge with a count doesn't also say "Not earned yet". Earned badges show their date only. The "18 days in a row now" row under a badge's "18 of 30" is gone.
- **Gifts, the verdict, Recap, Settings:** a forgiveness reason that starts with the answer's note doesn't repeat the note. "The gift you give goes from…" (the name is earlier in the sentence; this replaces October 30's "the gift you give Jordan goes from"). How the gifts were set ends "The gift you get." under the sum. Recap's This week card says "Gym" over "2 of 4". Settings' section heading is "The challenge", not the name its first row shows. The cap switch drops its repeat line, and the waiting card drops "It ends once Jordan agrees".
- **First days:** a theme's sheet says "30 days" instead of listing the rules shown under it, and its card says "6 rules" instead of "75 days" beside "75-Day Challenge". Sign up says "Sent a new link." and "Send link". Set up's dates row drops the name in the title, an open row hides its summary, and a rule's line doesn't repeat a number in its title ("60 min or less" under "Social media and games, 60 min or less"). Your challenges' buttons are "Open challenge" and "Start this challenge" under the card's own name. Invite's and the pact's whole-pact sheet lists each shared rule once (Both of you / Only you / Only Maya), and a signed line doesn't print the name under the signature. Practice's review drops the answered rows it repeats.
- **Rule descriptions** (themes and sample data) no longer repeat the title: "With the lights low." under "In bed by 11 pm"; "Any workout at a gym. Weeks run Monday to Sunday." under "Gym, 4 days a week"; no "Attach the screenshot" where the field says Required.
- Whether a title already says a number or the days is one helper now, `titleSays` and `whenUnlessTitled` in `lib/next/format.ts`.

Kept on purpose: the calendar and week legends (the squares have no other labels), Overview's "Waiting for you" card beside the Review badge (the card says what waits), Review's "1 of 4" (a position, not the count), field labels under a sheet's title (every field keeps a visible label), and the Monday notification preview, which has to make sense on its own.

## Decisions, November 2, 2026 (nothing scrolls a little)

Erin, on a habit's calendar sheet: "find everything that scrolls only a little and adjust it so it is not scrollable. Things are stacked way too much on top of each other … There needs to be more to the right." Every sheet and page was measured at 390×844 (a phone) and in a 700×668 window. Each one that was a little too tall was made shorter, not given a scrollbar. It's rule 11 in `README.md`'s checklist.

- **A sheet's Back is an arrow before its title,** not a row of its own repeating the title above the content (the kit's `Sheet` takes `back`). Sheets may use 32px more of a short window, and keep less space above their buttons.
- **A habit's calendar** (Progress) puts "16 of 17 days done" and "1 point · 13 days in a row" to the right of the You and Jordan chips. The days are 44px squares, and a weekly habit's weeks are one row of squares beside "Weeks" (met, short by 1, this week) instead of a list. Whose days these are is said once: by the chips, or the line under the title, never also by a chip of its own.
- **A day's check-ins** (Progress, and a closed day on Check in) are one line each, the name with the status at the right. "Yes" beside Done and "No" beside Missed are gone; "33 min" stays under the name. Notes are a line, not a card.
- **Overview's day sheet shows one person at a time:** You and Jordan chips at the top, each with that person's day square, so both are still seen at a glance. From 640px "39 min" follows the habit's name on its line.
- **Badges** are two to a row on Progress. On the verdict, You and Jordan sit side by side from 640px in plain lists.
- **Check in's "Choose a day"** shows the closed days as one row of day squares (Thu 12 to Wed 18), not seven rows.
- **Check in** puts "3 left ›" beside the date ("Thu, Nov 19" on phones), with the progress bar and "4h 29m to go" on one line under it: no card of its own. "Add screenshot" is a low strip with the icon beside the label (it keeps the label). From 640px the answer and its screenshot sit side by side, and the question is its largest only on laptops. A late answer's sheet uses the question as its title instead of asking it twice.
- **How it works** (Landing and Invite) and a theme's rules on Start are two to a row from 640px. Landing's four points are too.
- **The verdict on a phone:** "Not given yet" is gone, since the button says it. Best streaks and Badges sit side by side, and the spacing is a little tighter.
- **Practice's** title is for screen readers only. The sticky "Practice. Nothing here counts." banner already says what the page is.
- **Shared and Say your rules** are a little tighter: the rules box is four lines, and the example's button sits beside it from 640px.

Still scrolling, on purpose: long lists and forms (All 8 habits, the rule library, Edit rule, Propose a change), pages with much more than a screen (Overview, Progress, Gifts, Rules and help, Review, Recap, Settings, a closed day with its journal), and Practice in a window under about 750px tall (its last step's one-line preview sits under Save).

## Decisions, November 2, 2026 (fourth design critique)

A fourth critique scored the app 27/40 (26, 28, 26, 27). It found no P0s and four P1s: money words that drift, two actions with no Undo, numbers that disagree between pages, and a Progress page 4,351px tall on a phone. Erin asked for everything to be fixed overnight without questions, so the calls below were made without her; each is small to reverse.

Undo and safety:

- **Set up's Remove leaves an Undo row.** Removing a rule puts "Removed · No eating out" with Undo in its place for a few seconds, or until the next change; Undo puts the rule back where it was and focuses its Remove button.
- **Review's point rows wait like every decision.** Forgiving one of Jordan's points and asking Jordan to forgive one of yours are held for 5 seconds with the same Undo line, and say what they change first: "Forgiving it takes $9 off the gift you get."
- **Approve both shows both.** On a day with several answers waiting, it opens a sheet with every answer, its rule and screenshot, and approves only from there.
- **Review's progress strip colours each item by what you did,** so a dispute is no longer green. The badge counts a decision still in its Undo window as done. After a decision, focus moves to the next card's heading.
- **Asking to end says what it would settle:** an "If it ended now" box with each gift and the check-ins still open.

The same numbers everywhere:

- **Points come from points.** Progress counted a point with a forgiveness request as waiting; it's a point ("1 asked to forgive"). Totals count only closed days and finished weeks ("95 of 102 done", not "of 169"), and a weekly habit counts weeks.
- **Overview's day sheet counts weekly rules too,** so "1 of 6 missed" matches its rows, with weekly ones in their own group.
- **Recap shows the gifts as they are now** ("$45", what Gifts shows), with "Now, up $15 last week" under each.

Progress, shorter (4,351px to 2,100px on a phone):

- It leads with what's open today and Log, then the whole challenge for each of you, then the three weakest habits, worst first, and "All 8 habits", which opens the rest in a sheet. Badges are one row each. A wrapped line ends with its "·" instead of starting with one.

Money words, one set:

- **Never "buy".** "buys" and "buy" are gone from Practice, Gifts, Rules and help, Set up, the shared page, Invite and the pact ("the gift you give", "the gift you get"). The setting is "What a point costs" everywhere, and Settings' "First point: $1". The landing page's fourth step is "Points set the gift you give: Each miss is a point."
- Set up explains its estimate and the cap: how many points take a gift to the cap, and that points after that cost nothing.

Smaller fixes:

- **Check in's Save looks like a filled button** even before it can save; pressing it early scrolls to the missing part and focuses it (the hint still says why). A late answer's sheet does the same.
- **The end of a day drops See answers** (the squares above already show them) and shows the streak on its own line.
- **Your challenges fills "Open Fall Reset"** while one is running; Start a new challenge becomes the filled button only once it's finished. Share link says what's shared: "its name, rules and stakes, never your answers".
- **The pact uses the signed-in person** in the live app (a signed viewer saw the partner as "you"); step 3 shows the promises as a card; on laptops the Hold to sign bar is 384px and centred.
- **Practice's sample answers include the screenshot** a required rule needs, so every sample can be saved as it is. Landing's How it works says "Each day, answer for the day before."
- **Say your rules' example sits under the box,** so Draft my rules stays in view on a phone.
- **Sign up keeps its password hint** when there's an error: "Choose a password of at least 8 characters."
- The shared page drops its "Dry colours" label; a rule's row skips "4 days a week" when its title already says it; the top bar's challenge name is one row with the day at every width; the count-up never starts below its first number.

Not changed, on purpose:

- A calendar day with a forgiveness request still shows Waiting (the clock): the point isn't settled.
- The 5-option picker for what a point costs, the 720px laptop column, and Overview's "Waiting for you" card (it says what's waiting; the badge only counts).

For Erin, from the critique (not decided overnight): should Reply be a free veto, since a dispute still open at the end never becomes a point? Should each person name the gift they'd like? Should Progress fold into Overview?

## Decisions, October 30, 2026 (third design critique)

A third critique scored the app 26/40 (26, then 28, then 26; each run has a fresh reviewer). Two points were real regressions from the second round: Review lost its Undo when the pop-ups went, and the screenshot message doesn't scroll to the field. Erin's answers: Review safety first, keep "points" but say it plainly, show the count on a day with a miss, and take on the two P1s and the red days.

Built first, Review safety:

- **Every decision can be undone for 5 seconds, on the page.** Approve, Dispute, Forgive, Decline, Concede and a reply show at once (the card leaves with its stamp) and a line above the next card says "Approved · 10,000 steps" with Undo. The decision is sent only when the 5 seconds are up, so Undo needs nothing from the database and works in the live app too. The next decision, leaving Review or hiding the app sends the one waiting straight away.
- **The pinned bar only ever holds an answer's Dispute and Approve.** Forgive and Decline, and Reply to Jordan and Concede, are buttons inside their cards, so a quick second tap on the bar can't forgive a point or concede a dispute you never saw. Taps in the 0.6 s after a decision are ignored.
- **The bar comes right after the card,** so a keyboard reaches it before the rows below and it scrolls away with the card (it replaces the bar's "step aside" from October 29). Its buttons are in reading order: Dispute, then Approve.

Then the points wording ("keep points, say it plainly"):

- **Overview gives both numbers and who's ahead:** "6 points to Jordan's 9 · you're ahead" ("… · Jordan's ahead", "6 points each · tied"), as a line under the two gift cards that opens Gifts (it said "You're ahead by 3 points" beside the heading, which read as having more). Gifts' pill says "Ahead · 3 fewer points".
- **The gift you get, the gift you give.** No "your gift" or "the gift you owe" anywhere: forgiving one of Jordan's points says "The gift you get goes from $45 to $36"; conceding says "the gift you give Jordan goes from $21 to $28"; How it works and a shared challenge say "The gift you give".

Then the miss count ("show the count"):

- **A missed day says how many.** It keeps the missed colour and X (any miss makes it a missed day), and now shows the count beside the X: "✗ 1" on Overview's week and under the date on the Progress calendar. Opening it says "1 of 6 missed" (on Overview's day sheet, per person), and a screen reader hears "You: missed 1 of 6". A day with one miss out of six no longer looks like a day with six.

That finishes the round Erin chose from the third critique (Review safety, the points wording, the miss count).

## Decisions, October 29, 2026 (second design critique)

A second critique scored the app 28/40 (up from 26). Erin's answers: fix Review and disputes first, take on everything it found, give signing and the verdict their own layouts within Calm, and make ending the challenge need the partner's OK, like a rename.

Built first, Review and disputes:

- **Review doesn't judge the partner's number.** It said "✓ Meets the target" in green beside a number Jordan typed; it now says "Target: 10,000 steps or more" in plain grey, so the reviewer compares the claim with the screenshot. A number that misses still says so in red (that's Jordan's own admission).
- **The screenshot is the biggest thing on the card:** the card's full width under the answer on phones, a tall tile beside the answer and note on wider screens. Sheets keep the small tile.
- **The Approve/Dispute bar steps aside** once its card has scrolled out of view, so it never acts on something you can't see (`ActionBar`'s new `away`).
- **Being disputed leads with replying.** The main button is "Reply to Jordan" (it was Concede, with replying behind "Keep it open"); Concede is the second button. The reply sheet is titled "Reply to Jordan" and says Jordan reads exactly what you write.
- **A dispute still open at the end is explained.** Rules and help answers "What if a dispute is still open at the end?" (it isn't a point; either of you can still settle it on Review, and the gifts change if it's conceded), and the verdict shows "1 dispute is still open", which opens Review. The help's reviewing answer now says "concedes" and "replies", the buttons' words.
- The card's rule name is an h2 under the page's h1 (it skipped to h3).

Built second, hardening:

- **Hold to sign answers a tap.** Holding still signs. A tap, a click, Enter, a screen reader or Voice Control opens "Sign Fall Reset?" with the stakes once more and a plain Sign button, so nobody is stuck and a stray tap still never signs. A drifting thumb no longer resets the hold (the button doesn't scroll the page).
- **Check in's Save says why it can't save.** It stays focusable instead of going grey and silent; pressing it early says "Enter a number to save." (or "Choose Yes or No.", or "Change the answer to save.") next to it, and a screen reader hears it. The same goes for Send late answer.
- **The challenge's name is a full 44px target.** Below 1024px it shares one row with "Day 19 of 30" (name left, day right); on laptops they stack beside the top nav as before. The Progress calendar's days were already 45×48 (the critique measured them mid-animation).
- **Ending a running challenge takes both** (`supabase/next/end-requests.sql`). End the challenge in Settings now asks: "Ask Jordan to end Fall Reset?", then "Waiting for Jordan · End Fall Reset now" with Withdraw. Jordan sees "Maya asks to end Fall Reset now" at the top of Overview (and in Settings) with Keep going and End it, which confirms first. Before Day 1, either can still cancel at once.
- The Progress streak reads "1 day in a row" to a screen reader (it said "1 days").

Then, from Erin while the round below was built:

- **No pop-ups anywhere.** "Should not pop up and say save when you log something", then, on the journal's "Note added · Undo": "no pop ups like this in the whole app". Every toast that confirmed an action is gone (Saved, Sent, Approved, Note added, Name saved, Withdrawn, Signed, gift marked…), and with it the preview's toast Undo. The page shows what changed instead: the card glides on, a row says Sent or Given, Copy link turns into "Copied" for two seconds, "Send a new code" says "Sent a new code to …" under it. Where Undo was the only way back, the page has its own: removing a journal note (or saving it empty) asks "Remove this note?" in the note itself with Keep and Remove; a marked gift can be unmarked on the verdict; Say your rules' Start over keeps the sentence in the box. Only a write that fails in the live app still shows a message. It's rule 9 in `README.md`'s checklist.
- **The add-screenshot button never squeezes its words.** Before the first screenshot it's a wide dashed area with the icon in a round well and "Add screenshot"; after it, a tile the size of a screenshot with the icon alone ("Keep the label" on the wide one).

### Design round, October 30, 2026: signing, the verdict and the end of a day · picked

Erin chose own layouts within Calm for the moments that matter. Each page kept v1 (the page as it was) and added v2 and v3, listed under Sign the pact, Check in and The verdict below. Erin picks each round from now on ("why does kazzy have to pick? I will be picking"): signing 3, the verdict 2, the end of a day 3. Each pick is now the page's `v1.tsx` and the others are deleted.

Then distill, October 30, 2026 (Erin's answers: squares with icons, a bar and the streak per habit, changed in place):

- **One way to draw a day, everywhere.** Overview's week, the Progress calendar, each habit's calendar and the end of a day on Check in all use the same day square: Erin's colours (frosted, the same in light and dark) with a dark icon in each, a check for done, an X for missed, a clock for waiting, a heart for forgiven, a dashed circle for open, a dash for no visit. The calendar keeps its dates, with the icon under each. A status never rests on colour alone. It's the kit's `nx-day` and `DayIcon`, and the legends use the same small squares.
- **Progress habits show a bar and the streak** for each of you; the % is gone (it clashed with "15 of 30 done" above).
- **Overview's "Left to log" is one card with the Log button in it.** The big number, the time left and the open check-ins sit above Log Thursday; the card itself no longer opens Check in, so there is one thing to tap instead of two.

Then clarify, October 30, 2026 (the copy the critique flagged):

- **Your challenges says whose points:** "You won, 4 points to Jordan's 7" (it said "4 points to 7", which read like a loss); "Jordan won, 3 points to your 5".
- **Overview says which day:** "3 left to log for yesterday" (or "today"), so the date in the title and Log Thursday no longer disagree.
- **Practice:** "Practice. Nothing here counts." (it said "Nothing here is saved" above a Save button).
- **Invite leads with the same stake as the pact:** "At stake ~$150 · Each gift, if you miss 1 in 10" instead of "First miss $1"; its line reads "Each miss adds to the gift you give Maya: $1 for the first, $2 for the second, and so on."
- **Plain words:** the shared challenge's "Dry look" is "Dry colours"; the verdict's "Save as…" is "Save for later", like the shared page.
- **Gifts shows Jordan's note once:** a point's sheet left out the answer's note when the forgiveness request said the same words.
- **Recap's streaks say when:** "Longest streaks that week · 14 days · No phones in the bedroom", then "18 days now, still going".

Then polish, October 30, 2026:

- **Set up's First day reads like the rest of the app:** "Monday, Nov 2" with a calendar icon, in a box like the Name field, instead of the browser's "2026-11-02". The phone's own date picker still opens on a tap.
- **The first-point keys have room on phones:** a little less gap and 16px type below 420px, so "$0.25" no longer touches its border.
- Check in's "Add a note to this answer" stays as it is: its background shows only when pressed and reaches 12px left of the column so the icon lines up with the text, like every quiet button in the app.

That's everything from the second critique; the next step is a third critique to compare with 28/40.

## Decisions, October 27, 2026 (design critique)

A design critique scored the app 26/40. These fix what it found:

- **The point count matches everywhere.** Review's forgiveness row said "Jordan has 8 points" while Overview and Gifts said 9 (it left out the point already asked about). It now says "Jordan has 9 points · 8 not asked about yet".
- **Disputing says what happens.** The sheet says there is no point while it's open, that it becomes a point only if the partner concedes, and that you can withdraw it. The reason box asks "What looks off to you?" and says the partner reads exactly what you write.
- **The pact leads with what's at stake.** The second number is "At stake: ~$150, each gift, if you miss 1 in 10" (it opens the step sheet). The rules are one list, tagged "Only you" or "Only Maya" where a rule is one person's, with both signatures under it. Sign is now Hold to sign: a press fills the button and signs when full, so a stray tap never signs; a keyboard or screen reader signs at once.
- **Gifts come first on Overview,** right under the log card, as "You get" and "Jordan gets" (the words Gifts uses), with Waiting for you and the gym week below.
- **Your challenges names the product in its top bar** instead of repeating the running challenge's name and day right above its own card.
- **Set up shows its steps** ("Step 1 of 2", "Step 2 of 2 · Rules from Dry Month" when the rules came from a theme), and an empty name says "Give it a name, like “Fall Reset”."
- **A forgiven point shows a dash, not $0,** on Gifts. The landing page's fourth step reads "Misses add to the gift you give" (whose gift was unclear).

### The app's style (all pages) · picked

Three styles were tried across every page: 1 Calm (the kit as it is: violet glass, Georgia titles), 2 Warm (paper and cocoa, Young Serif, solid cards, pill buttons) and 3 Bold (flat, high contrast, Bricolage Grotesque, the accent as the main button).

Pick: **Style 1 · Calm.** Styles 2 and 3 and the preview's Style menu were removed.

## Decisions, October 25, 2026

- **A challenge being set up shows on Your challenges.** Its card says "Not started yet" with its name, start date and length (or who it waits for), and one filled button: Keep setting up, or Sign the pact. While it is being set up the page has the plain frame, since there is nothing for the tabs yet. Back from Start now reaches Your challenges instead of bouncing to "Name your challenge".
- **A draft keeps what you typed.** Set up saves a challenge still being set up a second after each change and when you leave, so a name typed and left shows on Your challenges under that name, and Keep setting up opens it with the name filled in. Create new challenge on Start reopens that draft instead of clearing it (a theme or saved challenge still replaces it).
- **The landing page fits on one screen, phones included.** The themes are small tiles, two to a row (on phones just the name and facts, without the icon), "Or start from a theme" is a small label, the spacing is tighter, and the fourth step reads "Each miss adds to their gift" so it stays on one line. Checked in the app's sizes: 375x667, 390x844, 1200x860 and 1280x720 all fit without scrolling. On laptops and bigger screens the title, steps, tiles and spacing grow with the screen's height (the title up to 64px), so a big screen is filled instead of the page sitting small at the top; the width stays 720px like every page.
- **How it works never scrolls.** Each step's explanation is one short line ("Pick the rules, then you both sign."). The gift example keeps the misses field full width (side by side, it squeezed "6 check-ins"), with "The gift you owe" and its sum on the left of one row and the amount on the right. On phones the sum is left out. It fits a 1280x720 laptop and a 375x667 phone.
- **No dead ends.** From every page there's a way to Your challenges:
  - "The Challenge" at the top left opens it (on the landing page it stays on the landing page). While a challenge runs, its name at the top does the same, besides More.
  - The menu under your name (Start, Set up, the invite, the pact, Your challenges) has Your challenges first.
  - After you sign with your partner already in, the app opens Your challenges, whose card says "Waiting for … to sign"; the separate waiting screen is only for sending the invite link before they have an account, and the card then says "Send the invite link".
  - Set up's last button says "Sign and finish" instead of "Send to … to sign": nothing is sent, they sign when they next open the app.
  - Sign the pact's Back goes to Your challenges in the app (it pointed at the invite, which the partner can no longer open). A new account's Start has no Back, since there is nothing behind it yet.
  - On phones, Progress's calendar days and Overview's week days are 44px wide.
- **A polish pass over every page.** Every page and sheet was measured at 375x667, 390x844 and 1280x800 for scrolling it barely needs, text that's cut off, anything sticking out sideways, text under 14px and broken images:
  - Practice day missed fitting a 1280x800 laptop by 5px; its timeline's gaps are 4px tighter, so it now fits.
  - A number never ends a line apart from its word ("2 waiting", "60 min"), in every row and on Progress; row text also wraps so a single word isn't left alone on the last line.
  - Plain words for the dollar amount: "Step" (Invite, Sign the pact) is now "First miss", and Settings' "Dollar step" is "First miss costs".
  - Appearance's "Match phone" is "Auto", so it fits its button on one line.
  - A shared challenge's rules no longer say "No screenshot"; they only mention a screenshot when one is asked for.
  - Still open: Progress's calendar days and Overview's week are 34–38px wide on phones, under the 44px tap size.
- **thechallenge.win/ opens the new app.** The home page forwards to `/app` (keeping an invite or shared link), and the home-screen icon is named The Challenge and opens `/app`.

## Decisions, October 21, 2026

- **A page that fits never scrolls.** Checked all 19 pages at 375x667, 390x664, 390x844, 430x932 and 1280x800, and the steps inside Set up and Start: none scrolls unless its content is taller than the screen (in the preview, the 1 2 3 bar takes 60px of the screen; the app has no such bar). Set up's checklist was the one that missed by a little: its Back now sits in the top bar (PlainFrame's `back` takes an `onClick` for a step back within a page) instead of on its own row under "The Challenge", so it fits.
- **No icons in status labels.** Every status pill (Done, Missed, Met, Needs 4, Waiting…) is its words and colour only, with no ✓, ✗, — or other icon, on every page.
- **Gaps before the next challenge, filled.** Review has two rows under the queue: "Ask Jordan to forgive a point" (any of your points with no ask waiting, such as a day you never logged or a short gym week) and "Forgive one of Jordan's points" (shows what it does to your gift). Your own journal notes have a pencil to change them. Each finished challenge's card opens its own verdict, also while the next one runs. Start, Set up, the invite screen and the pact have your name at the top right, opening Sign out and, before Day 1, Cancel this challenge (it's deleted for both). Settings has End the challenge while one runs: the days that are over count and the verdict opens. Sign in has "Forgot your password?" (a code and a new password). Once both have signed for a later start, Overview shows "Day 1 is …" with a practice day, and the top bar says "Starts Nov 2".

## Decisions, October 18, 2026

- **Calmer buttons, like today's app.** Erin found the purple buttons too aggressive and preferred the old design. In every look the main button is now today's dark slate in light mode and a soft light grey with dark text in dark mode, with no coloured glow (`--nx-primary`). Secondary buttons are light glass with a thin grey border and ink text, not purple. Each look's own colour (`--nx-fill`) stays on small things only: theme swatches, badges, today's marker, the progress dots.
- **Smaller everything.** "Things are too big": buttons are 44px (48px for `size="lg"`) with 16px medium-weight labels, corners are smaller (11px buttons, 14/18px cards), card padding is tighter, and titles and big numbers step down (page titles 28–36px, stat numbers 30/40px, the landing title 32–46px). Body text stays at 17px and secondary at 15px, Kazzy's floor.

## Decisions, October 1, 2026

Built on October 1, 2026 (see "What's built" below). Each page's pick is now its only version, `v1.tsx` in its folder.

- **Every page takes up the same amount of the screen.** The same content width and side margins on every page, on phones and laptops. As said: "The pages need to be consistent with how much of the page they take up."
- **Picked as they are:** Landing 2, Sign up and sign in 2, Shared challenge link 1, Say your rules 1, Your challenges 2, Invite 2, Sign the pact 2, Practice day 2, Overview 1, Check in 2, Rules and help 1, Review 2, Monday recap 2, The verdict 2, Settings 1.
- **A mix:** Start a challenge keeps version 3's four options, but as long rows the full width of the page, stacked on top of each other, in this order: Create new challenge, Say your rules, Saved challenges, Themes. Create new challenge replaces "Start blank" (it starts a blank challenge) and is the one highlighted, filled row.
- **Kept for now, but they need another design round:**
  - Set up and rules (version 1): neither version is good.
  - Gifts (version 1): neither version is great.
  - Progress (version 1): neither version is right.

## What's built, October 1, 2026

- **The picks are the pages.** Every version that wasn't picked is deleted, with the helpers only it used. Each page is now `v1.tsx` in its folder, so `/preview` shows one design per page and hides the 1 2 3 buttons. Set up and rules, Gifts and Progress keep their version 1 until their next round, which adds `v2.tsx` and `v3.tsx` beside it (and raises their count in `tests/next.mjs`).
- **One width for every page.** Both frames use the same 720px column with the same side margins (20px on phones and tablets, 32px on laptops), and the laptop top bar lines up with it. The frames' `wide` and `width` options are gone. Landing, Your challenges, Overview and Progress lost their side-by-side laptop layouts and read top to bottom like every other page.
- **Start a challenge** is four long rows the full width of the page: Create new challenge (filled in the accent colour; opens a blank Set up), Say your rules, Saved challenges, Themes. The last two glide to their list, and each item there opens its details.
- **Fixed on the way:** in dark mode a switched-on toggle (Settings reminders) used the classic look's violet on every look; it now uses the look's own colour.
- Checked at 375px and 1280px, in light and dark, on all 19 pages: same width and margins everywhere, no sideways scrolling, no text under 14px.

## First day

### Landing page (`landing`)

1. One column: two plain sentences, Start a challenge right under them with I have an invite and How it works as text links, then the four themes as a 2-by-2 grid of cards in their own colours (four across on laptops).
2. How it works as four short lines with icons, then Start a challenge and an outlined I have an invite; the themes are rows with length and rule count, beside the text on laptops.

Pick: 2

### Sign up and sign in (`signup`)

1. A Sign up / Sign in switch above the form; the first-name field slides in and out; Email me a sign-in link is the outlined button under the main one.
2. No tabs: the title says which form it is, with Sign in / Sign up at the top right; a Use a password / Email me a link choice hides the password field and changes the main button's words.

Pick: 2

### Shared challenge link (`shared`)

1. The page wears Dry October's look; length (31 days) and what misses cost ($2, $4, $6…) come first as two big number buttons, then the rules, with Start this challenge and Save for later pinned at the bottom.
2. A soft cover in the challenge's colours (who shared it, the name, the look) with both actions right under it; length, cost and the rules follow as tappable rows.

Pick: 1

### Start a challenge (`start`)

1. Themes first: the four themes as big cards in their look colours (2 by 2 on phones, 4 across on laptops), then saved challenges as rows, then Say your rules and Start blank.
2. Say first: Say your rules is the one filled button at the top, then saved challenges and themes as compact rows to compare, and a plain Start blank last.
3. Two steps: pick how to start from four big tiles (a theme, a saved challenge, say your rules, start blank), then glide to the themes or saved challenges.

Pick: a mix of 2 and 3. Version 3's four options, as long full-width rows stacked on top of each other, in this order: Create new challenge (replaces "Start blank"; the one highlighted, filled row), Say your rules, Saved challenges, Themes. Built.

### Say your rules (`say`)

1. One page that grows: the text box stays on top and lights up the phrases it drafts from, then full rule cards appear with the Every night / Sun–Thu question answered on its card and Edit and Remove on each.
2. Two screens with a glide: write on the first; the second puts the question first as big answer buttons, then the rules as short rows that open an editor.

Pick: 1

### Set up and rules (`setup`)

1. One calm form in three sections (Details, Stakes, Rules), everything changed in place; the $150 stakes preview counts up as the step or cap changes; each rule has Edit and Remove.
2. Rules first as tappable rows (Remove inside each rule's sheet); stakes as one big $150 number and the details as short summary rows, each opening its own sheet with Save.

Pick: 1 for now. Neither version is good; this page needs another design round.

Round 2, October 20, 2026 (version 1 is the page above; `v2.tsx` and `v3.tsx` are new):

2. One step at a time: a wizard that glides between Name and dates, Rules, What a miss costs (the "about $150" number opens how it adds up) and Check and invite, with a labelled step bar, Back, and one filled button per screen; deadline and time zone are rows on the check screen that open sheets.
3. Checklist: four big rows (Name and dates, Rules, What a miss costs, Deadline and time zone), each showing its value in plain words and a tick when ready; a row opens in place, one at a time, and Done closes it; Invite Jordan is pinned and opens the first row that needs attention.

Pick: 3, October 21, 2026, with two changes from Erin: a "Name your challenge" screen comes first (the checklist showed a name before one was entered), and the green ticks are gone because they didn't say anything; a row that isn't ready says what it needs in the missed colour instead. Built: version 3 is now the page and the others are deleted.

### Your challenges (`home`)

1. Sorted by kind: the running Fall Reset card with Day 19 of 30 and two number buttons (3 left to log, 4 to review), then Saved, then Finished; Start a new challenge pinned at the bottom.
2. One card per challenge with everything about it together (verdict, rules, share link, Start again), counts as rows with count bubbles, Start a new challenge under the title, two columns on laptops.

Pick: 2

### Invite (`invite`)

1. The whole invite on one page: rules in one card grouped Both of you / Only you / Only Maya, how it works as two tappable lines, signed-in account at the bottom, Accept pinned.
2. Start date and dollar step as big tiles first, each group of rules as its own list, the signed-in account as a chip in the top bar, Accept pinned.
3. Compact: the rules behind a Both of you / You / Maya switch that glides between groups, with Accept and Suggest a change right under them.

Pick: 2

### Sign the pact (`pact`)

1. Signatures first: Maya's shown signed with its time and Sign on your line; your name writes in, and the countdown with Go to Overview appears where you signed; promises and rules follow.
2. Read first: date and step tiles, the promises, each person's rules on their own card with their signature line, Sign pinned at the bottom; signing glides to the countdown and Go to Overview.

Pick: 2

### Practice day (`practice`)

1. One step at a time: each sample check-in, then pretend Jordan's review, then the gift, sliding sideways under an Answer, Review, Gift step bar.
2. The whole day on one timeline: answers, pretend Jordan's review and the gift appear one under another, with the next action pinned at the bottom.

Pick: 2

Round, October 30, 2026 (the signing moment; version 1 is the page above):

2. **Signature lines first.** Under "Sign the pact", one card with two rows: "Starts Monday, Nov 2" and "About $150 each gift · If you miss 1 in 10" (each opens its sheet). Then the signatures: Maya's line signed in script with its time, and your empty line with Hold to sign right under it; holding fills the line with ink in step with the button. Signing writes your name in place, runs the seal round the card and turns the title into "You both signed", with the countdown and Go to Overview below. The 4 promises and the 8 rules are rows that open them, not on the screen.
3. **One step at a time.** "Step 1 of 3" under each title, with Back: what's at stake (~$150) and Day 1; then the rules with their "Only you" / "Only Maya" tags; then your signature line. Next is pinned at the bottom and becomes Hold to sign on step 3. After signing, "Day 1 starts in 1 day 3 hours" fills the screen in large type, with both signatures small below and Go to Overview.

Pick: 3, October 30, 2026 (Erin). Built: one step at a time is now the page, and versions 1 and 2 are deleted.

## Every day

### Overview (`overview`)

1. Numbers first: Thursday's 3 check-ins as one big number with time left, Log Thursday under it, then number buttons for review, gym and both gifts, then the week strip; two columns on laptops.
2. A short list: the whole top card is the filled Log Thursday button, then one row each for review, gifts, gym and the 18-day streak, then the week strip.
3. Side by side: a filled You panel (3 left, Log Thursday) next to a Jordan panel (4 waiting, Review), then a card each with gift, gym and streak on matching rows, then the week strip.

Pick: 1

Round, November 9, 2026: goals. Each person writes a few goals for the challenge in their own words. Their Overview shows them, and the partner's are one tap away. Nothing is scored or ticked off. The versions differ only in where your goals sit, and all three share the same editor and partner sheet.

1. **Where they fit.** A quiet "Your goals" card in the stack of rows under the Log card, with Change, and a "Jordan's goals" row at its foot.
2. **Your goals first.** Your goals in italic serif right under the day's title, before the Log card, with Change and Jordan's goals in one quiet row under them. Erin wanted them more prominent, in a card of their own that draws the eye, so version 2 became: the one tinted card on the page, right under the title, with "Your goals", Change in its corner, the goals large in serif, and Jordan's goals at its foot. Then (Erin): each goal a small numbered card inside it ("1. Run a 10K before New Year"), side by side, never stacked: one fills the row, two sit as a pair, and three or more sit in one row that scrolls sideways on a phone (so Log yesterday stays on the first screen) and in rows of three from 640px.
3. **One compact row.** A single row with the first goal ("Run a 10K before New Year · Your goals · 1 more") among the rows under the Log card. It opens a sheet with all your goals, Change, and Jordan's goals as a step inside it.

Pick: none of the first three as they were; version 2, reworked as above, November 9, 2026 (Erin). Built: Overview opens with the goals card (`goals-card.tsx`), Jordan's goals sheet shows the same numbered goals, and versions 1 and 3 are deleted.

### Check in (`log`)

1. Step by step: a '3 left' card on top, one question card at a time with Save on the card, gliding to the next; the journal below; a calendar button opens the day switcher.
2. Focus: one question fills the screen in large type, with a day chip, a '3 left' progress button and a journal sheet on top; Save and Skip pinned side by side at the bottom.
3. The whole day as a list: open check-ins expand in place one at a time, a saved one slides into Answered, and a row of day chips is the switcher.

Pick: 2

Round, October 30, 2026 (only the end of the day differs; version 1 is the page above, ending with a tick and "Thursday is logged"):

2. **What happens next.** "Thursday is logged", then up to three rows, each only when true: "Jordan reviews your 2 answers next" (opens Review), "1 new point · $7 · Read 10 pages" or "No new points for Thursday" (opens Gifts), and "18 days in a row · No phones in the bedroom" (opens Progress); "You can change an answer until 11:59 pm tonight" last. The main button is "Review Jordan's answers" while anything waits for you, else Go to Overview.
3. **Thursday at a glance.** "Thursday is logged", then one square per check-in with its short name: a colour and an icon for each status (a check for done, an X for missed, a clock for waiting for Jordan…), tapping one opens that answer; then the streak on one line with a flame (opens Progress). The main button is the same as version 2.

Pick: 3, October 30, 2026 (Erin). Built: the end of the day is now the day at a glance (a square per check-in, then the streak), and versions 1 and 2 are deleted.

### Timer (`timer`)

New page, November 8, 2026. Erin's decisions: the timer is a setting on a rule counted in minutes ("Arabic, 20 min"), which either person can turn on or off at any time, even after signing, from Set up or Rules and help. It has its own page rather than living in Check in, because Check in logs the day before and the timer runs on the day itself. Each day's sessions add up and keep counting past the target. Once the day is over, the total is saved as that day's answer by itself. The partner reviews it, seeing each session, and it can still be changed by hand on Check in.

1. **The clock first.** One rule on screen. Today's total is a big clock inside a ring that closes at the target. Past the target the ring turns green and laps again ("+2 min over your 20"). Start, then Stop and save with Pause beside it. Today's sessions show as chips, and the last 7 days as tiles. Several timed rules get chips at the top.
2. **Your timed rules first.** A card for each timed rule, showing today's total against its target and its own Start. Starting turns that card into the live timer, and the other cards step back ("Start instead"). A card opens a sheet with today's sessions and past days. "Time another rule" sits at the end.
3. **Today's progress first.** "12 of 20 min, 8 min to go" is the hero, with the session clock smaller beside it. The bar is made of today's sessions and keeps going past the target. Under it, this week as day squares with each day's minutes. Start, Pause and Stop are pinned at the bottom.

Pick: 1, November 9, 2026 (Erin), with one change: the Today line shows the total that will be saved ("Today · 32 min total, saved at midnight"). It grows while a timer runs and shows from the first session, so after several sessions the saved number is always in view. Versions 2 and 3 are deleted.

### Rules and help (`rules`)

1. One page: rules as rows grouped Both of you / Maya / Jordan, then the deadline and stakes, then short expandable answers; Propose a change pinned at the bottom.
2. Two tabs: Rules shows every detail on each card (days, how you answer, screenshot; two columns on laptops); How it works holds the deadline, stakes and the answers.

Pick: 1

### Review (`review`)

1. Everything on one page, Jordan's answers grouped under their day; the first card carries the one filled button, and Approve both sits outlined in the day's heading.
2. One item at a time on a big card with a large screenshot; Previous/Next, progress steps and See all; the two decision buttons pinned side by side at the bottom.
3. A compact checklist: approve answers inline, approve the whole day from the sticky bar, and open any row for its details, dispute or reply in a sheet.

Pick: 2

### Gifts (`gifts`)

1. Both recipient-first gift cards (Maya gets $45, Jordan gets $21, next miss, who is ahead); tapping one shows that payer's points below, newest first, with Jordan's forgiveness request above.
2. The two gifts are the switch; the chosen one opens as an itemized receipt, oldest point first so $1, $2, $3… add up, forgiven lines struck at $0 and '+$10 next miss' last.

Pick: 1 for now. Neither version is great; this page needs another design round.

Round 2, October 20, 2026 (version 1 is the page above; `v2.tsx` and `v3.tsx` are new):

2. Scoreboard: one head-to-head card, "You get $45" and "Jordan gets $21" as big buttons with each next miss, and a bar showing who is ahead by how many points; Jordan's forgiveness request is the main action; then one list of both people's points by day, newest first.
3. Plain sentences: "Jordan owes you a $45 gift" and "You owe Jordan a $21 gift" as two big rows that open the points behind them; under "What could change it", the forgiveness request (main action) and what each next miss adds. Nothing else.

Pick: 1, October 21, 2026, without the forgiveness request card: "the forgiveness ask should not be on this page" (it is decided on Review). Built: versions 2 and 3 are deleted. Then forgiveness only on Review: a point's sheet no longer forgives, declines or asks; it explains the point, shows any request, and a request waiting on you has Open Review.

### Progress (`progress`)

1. Calendar first, with Log Thursday on the calendar card and a You/Jordan switch; habits (streak and hit rate) and badges beside it on laptops; days and habits open drill-down sheets.
2. The streak to protect first and largest with the next badge under it; habits as cards ranked by streak, then the calendar and badge tiles; the main action in a sticky bar.

Pick: 1 for now. Neither version is right; this page needs another design round.

Round 2, October 20, 2026 (this week for both of you; habits weakest first): "none of these are good." Erin asked for a much simpler calendar, just colours with no ✓ or ✗ and one legend, and pointed to the original app's Progress page (the whole challenge as one stacked bar per person, every habit worst first with both people's bars, % and streak, and both people's badges). Both were replaced.

Round 3, October 21, 2026 (version 1 is still the page above):

2. Calendar first: a You/Jordan switch above a month calendar of plain coloured squares with one legend, then the whole challenge as a stacked bar per person, every habit worst first with both people's bars, % and streak (each habit opens its sheet), and both people's badges.
3. Original order: the whole challenge first, then habits worst first, then the colour calendar with its own You/Jordan switch, then badges; tapping a person's whole-challenge row brings up their calendar.

Pick: 3, October 21, 2026, with calmer colours: "the colours are way too vibrant and aggressive." Fully muted was "not pretty", so on this page each status colour is the usual bar colour about 30% mixed into the page background (softer, still clearly colour), and the calendar dates are smaller (14px, 15px on laptops) in the normal text colour. Built: version 3 is now the page and the others are deleted.

Colour round, October 21, 2026: softened kit colours were "not pretty"; Erin wants them "more beautiful". The page above is the same in all three; only its own palette changes (calendar squares with a soft sheen, legend and bars), light and dark:

1. Garden: soft sage, rose, honey and lavender pastels.
2. Jewel: richer emerald, raspberry, amber and violet.
3. Dusk: teal, coral, peach and lilac.

Pick: none of the three. Erin chose her own palette, the same in light and dark, with dark dates on every square and done #86C79C, forgiven #B4D7E3, missed #CC718A, waiting #E2BD71, open #8D9AD0. Then "more glassmorphic": each square is frosted colour (lighter top-left, see-through toward the bottom right, a white hairline and a soft glow of its colour), and days not yet come are plain glass like the cards, not white. A check-in in a day's sheet now opens that check-in (the answer, its screenshots full screen on tap, the note, a correction or dispute, when it was logged, and Every day of this habit) instead of jumping to the habit's calendar. Built: it is the page's only palette, and versions 2 and 3 are deleted. The calendar in each habit's sheet now uses the same plain squares and palette, with no ✓, ✗ or other marks ("there should not be characters on this"); days a weekly habit had no visit are an outlined square, and days a habit doesn't ask for are faint.

### Monday recap (`recap`)

1. 'You won last week' as the headline, then one tappable line per result with you and Jordan side by side, this week's gym with the main action, and the Monday notification last.
2. The Monday notification first, as it arrived, then the score and gifts as four big numbers that count up, cards for gym and streaks, this week's gym and a sticky Log Thursday bar.

Pick: 2

## Last day

### The verdict (`verdict`)

1. The two gifts are revealed first as big cards: "Mark gift as given" on the one you owe (the main button) and "Mark as received" on the one you get; best streaks, badges and what next follow.
2. A side-by-side scoreboard (crown and Won on Maya) flips both gifts in, then a gifts checklist and streak and badge cards; one sticky button marks $28, then $10, then becomes Run it again.

Pick: 2

Round, October 30, 2026 (the end of the challenge; version 1 is the page above):

2. **The result, then each gift.** The title says it: "You won Summer Sprint" (or "Jordan won…", "…was a tie"), with "4 points to Jordan's 7. Fewer points wins." under it. Then each gift is its own large card: who gives whom, the amount flipping in, a small hand-off from the giver's avatar to the other's, and its own button; marking it turns the button into a green Given or Received strip (with Undo) and the gift slides across. Then best streaks and badges as one row; Run it again is the main button once both gifts are marked.
3. **One gift at a time.** One compact line on top (both avatars, a crown on the winner, "You won, 4 points to Jordan's 7"), two tabs ("$10 to Jordan", "$28 to you"), and one large card for one gift with one button. Marking it glides to the other gift, then to "Both gifts are done" with best streaks, badges and Run it again. Either tab goes back to a gift.

On every version a marked gift can be unmarked (in version 1, in the gifts sheet), since the toast's Undo is gone; and Save as… says "Saved" in its own sheet.

Pick: 2, October 30, 2026 (Erin). Built: the result, then each gift is now the page, and versions 1 and 3 are deleted. A marked gift is unmarked with the Undo on its card's Given or Received strip.

## Settings

### Settings (`settings`)

1. A calm list of grouped rows that show each value; each change opens its own sheet (Propose to Jordan for name, step and cap); reminders and appearance apply at once; confirm sheets for leave and delete.
2. Every setting is an inline control on one page; switches, times and appearance apply at once, and typed changes wait for one Save bar that rises at the bottom.

Pick: 1
