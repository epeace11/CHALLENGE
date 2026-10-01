# Design log

Kazzy picks one version of every page at `/preview` with the 1 2 3 buttons. Write the pick and a short reason under the page; once a page is picked, the other versions are deleted from `components/next/pages/<page>/` and the pick becomes the page.

## Decisions, October 1, 2026

Picked, nothing built yet. The other versions stay in the code until building starts.

- **Every page takes up the same amount of the screen.** The same content width and side margins on every page, on phones and laptops. As said: "The pages need to be consistent with how much of the page they take up."
- **Picked as they are:** Landing 2, Sign up and sign in 2, Shared challenge link 1, Say your rules 1, Your challenges 2, Invite 2, Sign the pact 2, Practice day 2, Overview 1, Check in 2, Rules and help 1, Review 2, Monday recap 2, The verdict 2, Settings 1.
- **A mix:** Start a challenge keeps version 3's four options, but as long rows the full width of the page, stacked on top of each other, in this order: Start blank, Say your rules, Saved challenges, Themes.
- **Kept for now, but they need another design round:**
  - Set up and rules (version 1): neither version is good.
  - Gifts (version 1): neither version is great.
  - Progress (version 1): neither version is right.

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

Pick: a mix of 2 and 3. Version 3's four options, as long full-width rows stacked on top of each other, in this order: Start blank, Say your rules, Saved challenges, Themes.

### Say your rules (`say`)

1. One page that grows: the text box stays on top and lights up the phrases it drafts from, then full rule cards appear with the Every night / Sun–Thu question answered on its card and Edit and Remove on each.
2. Two screens with a glide: write on the first; the second puts the question first as big answer buttons, then the rules as short rows that open an editor.

Pick: 1

### Set up and rules (`setup`)

1. One calm form in three sections (Details, Stakes, Rules), everything changed in place; the $150 stakes preview counts up as the step or cap changes; each rule has Edit and Remove.
2. Rules first as tappable rows (Remove inside each rule's sheet); stakes as one big $150 number and the details as short summary rows, each opening its own sheet with Save.

Pick: 1 for now. Neither version is good; this page needs another design round.

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

### Progress (`progress`)

1. Calendar first, with Log Thursday on the calendar card and a You/Jordan switch; habits (streak and hit rate) and badges beside it on laptops; days and habits open drill-down sheets.
2. The streak to protect first and largest with the next badge under it; habits as cards ranked by streak, then the calendar and badge tiles; the main action in a sticky bar.

Pick: 1 for now. Neither version is right; this page needs another design round.

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
