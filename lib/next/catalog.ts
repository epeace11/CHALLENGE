import type { Rule, RuleGroup, Target, Theme, Weekday } from './model.ts';

/**
 * Product data that ships with The Challenge: the rule library couples pick from and the themes
 * they can start from. Every rule here is for both people; a couple narrows it at setup.
 */

export const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
/** Sunday to Thursday: the nights before a work day. */
export const SUN_THU: Weekday[] = [0, 1, 2, 3, 4];
export const MON_FRI: Weekday[] = [1, 2, 3, 4, 5];

type Extra = Partial<Omit<Rule, 'id' | 'group' | 'title' | 'question'>>;

/** A Yes-or-No rule, every day and for both unless `o` says otherwise. */
export const yesNo = (
  id: string,
  group: RuleGroup,
  title: string,
  question: string,
  description: string,
  o: Extra = {},
): Rule => ({
  id,
  title,
  question,
  description,
  group,
  kind: 'yesno',
  days: EVERY_DAY,
  who: 'both',
  proof: 'none',
  ...o,
});

/** A number rule checked against `target`. */
export const numberRule = (
  id: string,
  group: RuleGroup,
  title: string,
  question: string,
  description: string,
  target: Target,
  o: Extra = {},
): Rule => ({
  ...yesNo(id, group, title, question, description, o),
  kind: 'number',
  target,
});

/** A rule counted per week against `perWeek` days. */
export const weeklyRule = (
  id: string,
  group: RuleGroup,
  title: string,
  question: string,
  description: string,
  perWeek: number,
  o: Extra = {},
): Rule => ({
  ...yesNo(id, group, title, question, description, o),
  kind: 'weekly',
  weeklyTarget: perWeek,
});

/** About 40 rules to build a challenge from, grouped Sleep, Screens, Food, Drinks, Movement, Mind, Money, Home. */
export const LIBRARY: Rule[] = [
  // Sleep
  yesNo(
    'lib-bed-11',
    'Sleep',
    'In bed by 11 pm',
    'Were you in bed by 11 pm?',
    'In bed with the lights low by 11 pm.',
    { days: SUN_THU },
  ),
  yesNo(
    'lib-up-7',
    'Sleep',
    'Up by 7 am',
    'Were you out of bed by 7 am?',
    'Out of bed, not just awake.',
    { days: MON_FRI },
  ),
  numberRule(
    'lib-sleep-7h',
    'Sleep',
    '7 hours of sleep',
    'How many hours did you sleep?',
    'From your watch or sleep app.',
    { op: '>=', value: 7, unit: 'h' },
    { proof: 'optional' },
  ),
  yesNo(
    'lib-no-phone-bedroom',
    'Sleep',
    'No phones in the bedroom',
    'Did your phone stay out of the bedroom all night?',
    'Phones charge outside the bedroom. An alarm clock is fine.',
  ),
  yesNo(
    'lib-read-in-bed',
    'Sleep',
    'Read before sleep',
    'Did you read before you fell asleep?',
    'A book or e-reader, not a phone.',
  ),
  // Screens
  numberRule(
    'lib-social-60',
    'Screens',
    'Social media and games, 60 min or less',
    'How many minutes of social media and games?',
    'Add up social apps and games in Screen Time and attach the screenshot.',
    { op: '<=', value: 60, unit: 'min' },
    { proof: 'required' },
  ),
  yesNo(
    'lib-screens-off-10',
    'Screens',
    'Screens off by 10 pm',
    'Were your screens off by 10 pm?',
    'Phone, laptop and TV.',
    { days: SUN_THU },
  ),
  yesNo(
    'lib-no-phone-meals',
    'Screens',
    'No phones at meals',
    'Did phones stay away during meals?',
    'Out of reach, face down or in another room.',
  ),
  yesNo(
    'lib-phone-free-morning',
    'Screens',
    'Phone-free first hour',
    'Did you stay off your phone for the first hour after waking?',
    'Turning off an alarm is fine.',
  ),
  yesNo(
    'lib-no-streaming',
    'Screens',
    'No streaming on weeknights',
    'Did you skip shows and videos tonight?',
    'Shows, movies and online videos.',
    { days: SUN_THU },
  ),
  // Food
  yesNo(
    'lib-no-eating-out',
    'Food',
    'No eating out',
    'Did you skip eating out?',
    'No restaurants, takeout or delivery. Coffee is fine.',
  ),
  yesNo(
    'lib-cook-dinner',
    'Food',
    'Cook dinner at home',
    'Did you cook dinner at home?',
    'Leftovers from a meal you cooked count.',
  ),
  yesNo(
    'lib-no-sweets',
    'Food',
    'No sweets',
    'Did you skip sweets?',
    'Desserts, candy and sweet drinks.',
  ),
  numberRule(
    'lib-vegetables',
    'Food',
    '5 servings of vegetables',
    'How many servings of vegetables did you eat?',
    'A serving is about a cupped handful.',
    { op: '>=', value: 5, unit: 'servings' },
  ),
  numberRule(
    'lib-calories',
    'Food',
    'Stay under your calorie limit',
    'How many calories did you eat?',
    'Your own daily limit, from your tracking app.',
    { op: '<=', value: 2000, unit: 'kcal' },
    { personalTarget: true, proof: 'optional' },
  ),
  yesNo(
    'lib-no-late-snacks',
    'Food',
    'No snacks after 8 pm',
    'Did you skip snacks after 8 pm?',
    'Water and tea are fine.',
  ),
  // Drinks
  yesNo(
    'lib-no-alcohol',
    'Drinks',
    'No alcohol',
    'Did you skip alcohol?',
    'No beer, wine or spirits.',
  ),
  numberRule(
    'lib-water-2l',
    'Drinks',
    'Drink 2 L of water',
    'How much water did you drink?',
    'Count bottles or glasses.',
    { op: '>=', value: 2, unit: 'L' },
  ),
  yesNo(
    'lib-no-soda',
    'Drinks',
    'No soda',
    'Did you skip soda?',
    'Diet soda counts as soda.',
  ),
  yesNo(
    'lib-no-late-caffeine',
    'Drinks',
    'No caffeine after noon',
    'Did you skip caffeine after noon?',
    'Coffee, black or green tea, soda and energy drinks.',
  ),
  yesNo(
    'lib-no-weed',
    'Drinks',
    'No weed',
    'Did you skip weed?',
    'Smoking, vaping and edibles.',
  ),
  // Movement
  numberRule(
    'lib-steps-10k',
    'Movement',
    '10,000 steps',
    'How many steps did you walk?',
    'Your phone’s step count for the day. Attach the screenshot.',
    { op: '>=', value: 10000, unit: 'steps' },
    { proof: 'required' },
  ),
  weeklyRule(
    'lib-gym-3',
    'Movement',
    'Gym, 3 days a week',
    'Did you go to the gym?',
    'Any workout at a gym. Three days in each Monday-to-Sunday week.',
    3,
  ),
  numberRule(
    'lib-workout-30',
    'Movement',
    'Work out 30 minutes',
    'How many minutes did you work out?',
    'Anything that gets your heart rate up.',
    { op: '>=', value: 30, unit: 'min' },
  ),
  yesNo(
    'lib-stretch',
    'Movement',
    'Stretch 10 minutes',
    'Did you stretch for 10 minutes?',
    'Any stretching or yoga.',
  ),
  yesNo(
    'lib-walk-outside',
    'Movement',
    'Walk outside 20 minutes',
    'Did you walk outside for 20 minutes?',
    'One walk or a few shorter ones.',
  ),
  // Mind
  numberRule(
    'lib-read-10',
    'Mind',
    'Read 10 pages',
    'How many pages did you read?',
    'Any book, paper or e-reader.',
    { op: '>=', value: 10, unit: 'pages' },
  ),
  numberRule(
    'lib-meditate',
    'Mind',
    'Meditate 10 minutes',
    'How many minutes did you meditate?',
    'Guided or silent.',
    { op: '>=', value: 10, unit: 'min' },
  ),
  yesNo(
    'lib-journal',
    'Mind',
    'Journal before bed',
    'Did you write in your journal?',
    'A few lines on paper or here in the app.',
  ),
  numberRule(
    'lib-language',
    'Mind',
    'Language practice, 15 minutes',
    'How many minutes did you practise?',
    'An app, a class or a lesson.',
    { op: '>=', value: 15, unit: 'min' },
  ),
  yesNo(
    'lib-one-good-thing',
    'Mind',
    'Write down one good thing',
    'Did you write down one good thing from the day?',
    'One line is enough.',
  ),
  // Money
  yesNo(
    'lib-no-extras',
    'Money',
    'No spending on extras',
    'Did you skip spending on extras?',
    'Bills, groceries and gas are fine.',
  ),
  yesNo(
    'lib-log-purchases',
    'Money',
    'Log every purchase',
    'Did you log every purchase?',
    'In your budget app or a note.',
  ),
  yesNo(
    'lib-no-online-shopping',
    'Money',
    'No online shopping',
    'Did you skip online shopping?',
    'Groceries for delivery are fine.',
  ),
  yesNo(
    'lib-pack-lunch',
    'Money',
    'Pack lunch for work',
    'Did you bring lunch from home?',
    'Leftovers count.',
    { days: MON_FRI },
  ),
  yesNo(
    'lib-save-10',
    'Money',
    'Move $10 to savings',
    'Did you move $10 to savings?',
    'A transfer or cash in a jar.',
  ),
  // Home
  yesNo(
    'lib-make-bed',
    'Home',
    'Make the bed',
    'Did you make the bed?',
    'Whoever gets up last makes it.',
  ),
  yesNo(
    'lib-dishes',
    'Home',
    'Dishes done before bed',
    'Were the dishes done before bed?',
    'Washed, or in the dishwasher and running.',
  ),
  yesNo(
    'lib-tidy-10',
    'Home',
    '10-minute tidy',
    'Did you tidy for 10 minutes?',
    'Any room.',
  ),
  yesNo(
    'lib-clothes-away',
    'Home',
    'Clothes put away',
    'Were your clothes put away before bed?',
    'Nothing on chairs or the floor.',
  ),
  yesNo(
    'lib-plan-meals',
    'Home',
    'Plan tomorrow’s meals',
    'Did you plan tomorrow’s meals?',
    'What you will eat and who is cooking.',
  ),
];

/** The four ready-made challenges. */
export const THEMES: Theme[] = [
  {
    id: 'seventy-five',
    name: '75-Day Challenge',
    look: 'seventy-five',
    days: 75,
    step: 0.25,
    summary:
      'Six rules every day for 75 days: your eating plan, two workouts, water, reading and a progress photo.',
    optionalRuleIds: [],
    rules: [
      yesNo(
        '75-eating-plan',
        'Food',
        'Follow your eating plan',
        'Did you follow your eating plan, with no cheat meals and no alcohol?',
        'The plan you each chose. No cheat meals and no alcohol.',
      ),
      yesNo(
        '75-workout-1',
        'Movement',
        'First workout, 45 minutes',
        'Did you do your first 45-minute workout?',
        'Any workout of at least 45 minutes.',
      ),
      yesNo(
        '75-workout-2',
        'Movement',
        'Second workout, 45 minutes outdoors',
        'Did you do a second 45-minute workout outdoors?',
        'Outdoors, at least 3 hours after the first.',
      ),
      numberRule(
        '75-water',
        'Drinks',
        'Drink 3.8 L of water',
        'How much water did you drink?',
        'About a gallon.',
        { op: '>=', value: 3.8, unit: 'L' },
      ),
      numberRule(
        '75-read',
        'Mind',
        'Read 10 pages of non-fiction',
        'How many pages of non-fiction did you read?',
        'A book on paper or an e-reader. Audiobooks do not count.',
        { op: '>=', value: 10, unit: 'pages' },
      ),
      yesNo(
        '75-photo',
        'Movement',
        'Progress photo',
        'Did you take your progress photo?',
        'One photo a day. Attach it.',
        { proof: 'required' },
      ),
    ],
  },
  {
    id: 'sleep',
    name: 'Sleep & Screens Reset',
    look: 'sleep',
    days: 30,
    step: 1,
    summary:
      'Five rules for 30 days: earlier nights, phones out of the bedroom and less scrolling.',
    optionalRuleIds: [],
    rules: [
      yesNo(
        'sleep-bed-11',
        'Sleep',
        'In bed by 11 pm',
        'Were you in bed by 11 pm?',
        'In bed with the lights low by 11 pm.',
        { days: SUN_THU },
      ),
      yesNo(
        'sleep-no-phone-bedroom',
        'Sleep',
        'No phones in the bedroom',
        'Did your phone stay out of the bedroom all night?',
        'Phones charge outside the bedroom. An alarm clock is fine.',
      ),
      numberRule(
        'sleep-social-60',
        'Screens',
        'Social media and games, 60 min or less',
        'How many minutes of social media and games?',
        'Add up social apps and games in Screen Time and attach the screenshot.',
        { op: '<=', value: 60, unit: 'min' },
        { proof: 'required' },
      ),
      yesNo(
        'sleep-screens-off-10',
        'Screens',
        'Screens off by 10 pm',
        'Were your screens off by 10 pm?',
        'Phone, laptop and TV.',
        { days: SUN_THU },
      ),
      yesNo(
        'sleep-up-7',
        'Sleep',
        'Up by 7 am',
        'Were you out of bed by 7 am?',
        'Out of bed, not just awake.',
        { days: MON_FRI },
      ),
    ],
  },
  {
    id: 'dry',
    name: 'Dry Month',
    look: 'dry',
    days: 30,
    step: 1,
    summary: 'No alcohol for 30 days. No weed can be added.',
    optionalRuleIds: ['dry-no-weed'],
    rules: [
      yesNo(
        'dry-no-alcohol',
        'Drinks',
        'No alcohol',
        'Did you skip alcohol?',
        'No beer, wine or spirits.',
      ),
      yesNo(
        'dry-no-weed',
        'Drinks',
        'No weed',
        'Did you skip weed?',
        'Smoking, vaping and edibles.',
      ),
    ],
  },
  {
    id: 'fitness',
    name: 'Fitness & Food',
    look: 'fitness',
    days: 30,
    step: 1,
    summary:
      'Gym four days a week, 10,000 steps, no eating out and your own calorie limit.',
    optionalRuleIds: [],
    rules: [
      weeklyRule(
        'fit-gym-4',
        'Movement',
        'Gym, 4 days a week',
        'Did you go to the gym?',
        'Any workout at a gym. Four days in each Monday-to-Sunday week.',
        4,
      ),
      numberRule(
        'fit-steps-10k',
        'Movement',
        '10,000 steps',
        'How many steps did you walk?',
        'Your phone’s step count for the day. Attach the screenshot.',
        { op: '>=', value: 10000, unit: 'steps' },
        { proof: 'required' },
      ),
      yesNo(
        'fit-no-eating-out',
        'Food',
        'No eating out',
        'Did you skip eating out?',
        'No restaurants, takeout or delivery. Coffee is fine.',
      ),
      numberRule(
        'fit-calories',
        'Food',
        'Stay under your calorie limit',
        'How many calories did you eat?',
        'Each of you sets your own limit. Use your tracking app.',
        { op: '<=', value: 2000, unit: 'kcal' },
        { personalTarget: true, proof: 'optional' },
      ),
    ],
  },
];
