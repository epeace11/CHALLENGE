# Design log

Kazzy picks one version of every page at `/preview` with the 1 2 3 buttons. Write the pick and a short reason under the page; once a page is picked, the other versions are deleted from `components/next/pages/<page>/` and the pick becomes the page.

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

Still to build from this critique: own layouts for signing, the verdict and the end of a day (2–3 versions each for Kazzy), one way to draw a day on Overview and Progress, and the copy and polish fixes.

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

## Every day

### Overview (`overview`)

1. Numbers first: Thursday's 3 check-ins as one big number with time left, Log Thursday under it, then number buttons for review, gym and both gifts, then the week strip; two columns on laptops.
2. A short list: the whole top card is the filled Log Thursday button, then one row each for review, gifts, gym and the 18-day streak, then the week strip.
3. Side by side: a filled You panel (3 left, Log Thursday) next to a Jordan panel (4 waiting, Review), then a card each with gift, gym and streak on matching rows, then the week strip.

Pick: 1

### Check in (`log`)

1. Step by step: a '3 left' card on top, one question card at a time with Save on the card, gliding to the next; the journal below; a calendar button opens the day switcher.
2. Focus: one question fills the screen in large type, with a day chip, a '3 left' progress button and a journal sheet on top; Save and Skip pinned side by side at the bottom.
3. The whole day as a list: open check-ins expand in place one at a time, a saved one slides into Answered, and a row of day chips is the switcher.

Pick: 2

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

## Settings

### Settings (`settings`)

1. A calm list of grouped rows that show each value; each change opens its own sheet (Propose to Jordan for name, step and cap); reminders and appearance apply at once; confirm sheets for leave and delete.
2. Every setting is an inline control on one page; switches, times and appearance apply at once, and typed changes wait for one Save bar that rises at the bottom.

Pick: 1
