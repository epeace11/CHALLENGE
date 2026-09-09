export type Person='Erin'|'Kazzy';
export type Rule={id:string;title:string;question:string;description:string;days:string;group:string;person?:Person;proof?:boolean;weekly?:boolean};
export const rules:Rule[]=[
{id:'bed',title:'In bed by 11 pm',question:'Were you in bed by 11 pm?',description:'Be in bed by 11 pm.',days:'Sun–Thu',group:'Sleep'},
{id:'phone',title:'Phone outside the bedroom',question:'Did you leave your phone outside the bedroom?',description:'Keep your phone outside the bedroom after 11 pm.',days:'Sun–Thu',group:'Sleep'},
{id:'screens',title:'No screens before sleep',question:'Did you stay screen-free after 11 pm?',description:'No screens of any kind from 11 pm until you fall asleep.',days:'Sun–Thu',group:'Sleep'},
{id:'weed',title:'No smoking weed',question:'Did you avoid smoking weed?',description:'No smoking weed on Sunday through Thursday.',days:'Sun–Thu',group:'Habits'},
{id:'prayer',title:'Pray daily',question:'Did you pray today?',description:'At least once, every day.',days:'Every day',group:'Habits'},
{id:'food',title:'No eating out',question:'Did you avoid eating out?',description:'Takeout and delivery count. Coffee is allowed.',days:'Every day',group:'Food'},
{id:'time',title:'Screen time: 1 hour or less',question:'Was your useless screen time an hour or less?',description:'Social media and games count. YouTube is excluded. Attach your Screen Time screenshot.',days:'Every day',group:'Focus',proof:true},
{id:'entertainment',title:'No entertainment before 6 pm',question:'Did you avoid entertainment before 6 pm?',description:'Content before 6 pm must be educational and related to work, including YouTube.',days:'Every day',group:'Focus'},
{id:'steps',title:'10,000 steps',question:'Did you walk at least 10,000 steps?',description:'Reach 10,000 steps and attach a step-count screenshot.',days:'Every day',group:'Movement',person:'Erin',proof:true},
{id:'calories',title:'2,300 calories or less + macros tracked',question:'Did you stay within 2,300 calories and track your macros?',description:'Both are required. Attach your ChatGPT macro screenshot.',days:'Every day',group:'Food',person:'Kazzy',proof:true},
{id:'gym',title:'Go to gym',question:'Did you go to the gym today?',description:'Condo or regular gym. One visit per day. Four visits per full week; Sep 8–12: three. Sep 28–30: one.',days:'Weekly',group:'Movement',weekly:true}];
export function toronto(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function shift(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function defaultDate(now=new Date()){return clampDate(shift(toronto(now),-1))}
export function clampDate(d:string){return d<'2026-09-08'?'2026-09-08':d>'2026-09-30'?'2026-09-30':d}
export function activeRules(person:Person,date:string){const dow=new Date(date+'T12:00Z').getUTCDay();return rules.filter(r=>(!r.person||r.person===person)&&(r.days!=='Sun–Thu'||dow<=4))}
export function money(points:number){return points*(points+1)/2}
export function formatDate(d:string){return new Date(d+'T12:00Z').toLocaleDateString('en-CA',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'})}
export function week(d:string){if(d<='2026-09-12')return {start:'2026-09-08',end:'2026-09-12',target:3};if(d<='2026-09-19')return {start:'2026-09-13',end:'2026-09-19',target:4};if(d<='2026-09-26')return {start:'2026-09-20',end:'2026-09-26',target:4};return {start:'2026-09-27',end:'2026-09-30',target:1}}
export type Profile={id:string;name:Person};
export type Entry={id:string;user_id:string;rule_id:string;day:string;done:boolean;status:string;note:string;proof:string|null;proposed_done:boolean|null;proposed_note:string|null;proposed_proof:string|null;updated_at:string};
export type Point={id:string;user_id:string;rule_id:string;day:string;reason:string;forgiven:boolean;voided:boolean;entry_id:string|null;created_at:string};
export type Request={id:string;point_id:string;requester_id:string;reason:string;status:string};
export type Dispute={id:string;entry_id:string;raised_by:string;comment:string;status:string};
export type Data={profiles:Profile[];entries:Entry[];points:Point[];requests:Request[];disputes:Dispute[];finalizations:{user_id:string}[]};
export const emptyData:Data={profiles:[],entries:[],points:[],requests:[],disputes:[],finalizations:[]};

/** Instant (ms) when logging for `date` locks: noon the next day, Toronto time, DST-aware. */
export function lockTime(date:string){const next=shift(date,1);let guess=Date.UTC(+next.slice(0,4),+next.slice(5,7)-1,+next.slice(8,10),12);for(let i=0;i<2;i++){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',hourCycle:'h23'}).formatToParts(new Date(guess));const get=(t:string)=>parts.find(p=>p.type===t)?.value??'';const localDay=`${get('year')}-${get('month')}-${get('day')}`,hour=Number(get('hour'));const dayDiff=(Date.UTC(+localDay.slice(0,4),+localDay.slice(5,7)-1,+localDay.slice(8,10))-Date.UTC(+next.slice(0,4),+next.slice(5,7)-1,+next.slice(8,10)))/864e5;guess-=(dayDiff*24+hour-12)*36e5;}return guess}
/** "3h 12m" style remaining time, or null once past. */
export function untilLock(date:string,now=Date.now()){const ms=lockTime(date)-now;if(ms<=0)return null;const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4);return h>0?`${h}h ${m}m`:`${m}m`}
