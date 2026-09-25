import { rules, activeRules, targetFor, shift, lockTime, toronto, START, END, type Data, type Entry, type Person, type Profile, type Rule } from './challenge.ts';

export { START, END };
export type Tone='done'|'excused'|'missed'|'review'|'open'|'future';
export const tones:Tone[]=['done','excused','missed','review','open','future'];
export const toneLabel:Record<Tone,string>={done:'done',excused:'excused',missed:'missed',review:'reviewing',open:'still open',future:'ahead'};
export type Counts=Record<Tone,number>;
export const emptyCounts=():Counts=>({done:0,excused:0,missed:0,review:0,open:0,future:0});
export const total=(c:Counts)=>tones.reduce((s,t)=>s+c[t],0);

export function days(from=START,to=END){const out:string[]=[];for(let d=from;d<=to;d=shift(d,1))out.push(d);return out}
export const closed=(day:string,now:number)=>now>lockTime(day);
/** Latest day whose logging window has opened: yesterday, but never before the start or after the end. */
export const maxLoggable=(now:number)=>{const y=shift(toronto(new Date(now)),-1);return y<START?shift(START,-1):y>END?END:y};
export const dayNumber=(now:number)=>Math.min(30,Math.max(0,Math.round((Date.parse(toronto(new Date(now))+'T00:00Z')-Date.parse(START+'T00:00Z'))/864e5)+1));

export const entryKey=(uid:string,rule:string,day:string)=>`${uid}|${rule}|${day}`;const key=entryKey;
export const index=(data:Data)=>{const m=new Map<string,Entry>();for(const e of data.entries)m.set(key(e.user_id,e.rule_id,e.day),e);return m};
export type Index=ReturnType<typeof index>;

/** Status colour of one habit on one day. */
export function tone(e:Entry|undefined,day:string,now:number,maxDate=maxLoggable(now)):Tone{
 if(day>maxDate)return 'future';
 if(!e)return closed(day,now)?'missed':'open';
 if(e.proposed_done!==null||e.status==='pending'||e.status==='disputed')return 'review';
 if(e.status==='excused')return 'excused';
 if(e.done&&e.status==='confirmed')return 'done';
 return 'missed'}

export const weeklyRules=(name:Person)=>rules.filter(r=>r.weekly&&(!r.person||r.person===name));
export const dailyRules=(name:Person,day:string)=>activeRules(name,day).filter(r=>!r.weekly);
export const weeklyDone=(data:Data,uid:string,rule:string,w:{start:string;end:string})=>data.entries.filter(e=>e.user_id===uid&&e.rule_id===rule&&e.day>=w.start&&e.day<=w.end&&e.done&&!['conceded','missed','unlogged'].includes(e.status)).length;

/** Every habit-day of the challenge plus the weekly targets (gym, Kazzy's steps), bucketed by colour. Weekly days count as done when logged and otherwise stay ahead until their week closes. */
export function personBar(data:Data,p:Profile,now:number,ix=index(data)):Counts{
 const c=emptyCounts(),maxDate=maxLoggable(now);
 for(const d of days())for(const r of dailyRules(p.name,d))c[tone(ix.get(key(p.id,r.id,d)),d,now,maxDate)]++;
 for(const r of weeklyRules(p.name))for(const w of data.weeks){const t=targetFor(w,r.id);if(!t)continue;const v=Math.min(t,weeklyDone(data,p.id,r.id,w));c.done+=v;
  if(w.start>maxDate)c.future+=t;
  else if(closed(w.end,now)){const short=t-v,forgiven=data.points.filter(q=>q.user_id===p.id&&q.rule_id===r.id&&q.day===w.end&&!q.voided&&q.forgiven).length,ex=Math.min(short,forgiven);c.excused+=ex;c.missed+=short-ex}
  else c.future+=t-v} // A week in progress is not 'open': the remaining days only resolve when the week is assessed.
 return c}

export type HabitStat={rule:Rule;counts:Counts;done:number;missed:number;rate:number|null;streak:number;best:number;reached:Record<number,string>;dollars:number};
/** Per daily habit: colour counts, hit rate, current and best streak (excused and open days neither break nor extend), dollars it has cost. */
export function habitStats(data:Data,p:Profile,now:number,ix=index(data)):HabitStat[]{
 const maxDate=maxLoggable(now),cost=costByHabit(data,p.id);
 return rules.filter(r=>!r.weekly&&(!r.person||r.person===p.name)).map(r=>{
  const counts=emptyCounts(),reached:Record<number,string>={};let run=0,best=0;
  for(const d of days()){if(!dailyRules(p.name,d).some(x=>x.id===r.id))continue;const t=tone(ix.get(key(p.id,r.id,d)),d,now,maxDate);counts[t]++;
   if(t==='done'||t==='review'){run++;best=Math.max(best,run);for(const n of [7,14,30])if(run===n&&!reached[n])reached[n]=d}else if(t==='missed')run=0}
  const done=counts.done,missed=counts.missed;
  return {rule:r,counts,done,missed,rate:done+missed?done/(done+missed):null,streak:run,best,reached,dollars:cost.find(c=>c.rule===r.id)?.dollars??0}})}

/** Habits ordered worst first across both people: most misses, then lowest hit rate. */
export function habitOrder(stats:Record<string,HabitStat[]>):Rule[]{
 const agg=new Map<string,{rule:Rule;missed:number;rate:number;n:number}>();
 for(const list of Object.values(stats))for(const s of list){const a=agg.get(s.rule.id)??{rule:s.rule,missed:0,rate:0,n:0};a.missed+=s.missed;a.rate+=s.rate??1;a.n++;agg.set(s.rule.id,a)}
 return [...agg.values()].sort((a,b)=>b.missed-a.missed||a.rate/a.n-b.rate/b.n||rules.indexOf(a.rule)-rules.indexOf(b.rule)).map(a=>a.rule)}

/** Position-based cost of each active point, matching the ledger: the n-th point costs $n. */
export function pointCosts(data:Data,uid:string){const m=new Map<string,number>();[...data.points].filter(q=>q.user_id===uid&&!q.forgiven&&!q.voided).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)).forEach((q,i)=>m.set(q.id,i+1));return m}
export const nextMissCost=(data:Data,uid:string)=>pointCosts(data,uid).size+1;
export function costByHabit(data:Data,uid:string){const costs=pointCosts(data,uid),m=new Map<string,{rule:string;dollars:number;count:number}>();
 for(const q of data.points){const c=costs.get(q.id);if(!c)continue;const a=m.get(q.rule_id)??{rule:q.rule_id,dollars:0,count:0};a.dollars+=c;a.count++;m.set(q.rule_id,a)}
 return [...m.values()].sort((a,b)=>b.dollars-a.dollars||b.count-a.count)}

/** Misses per person on a closed day, daily habits only. */
const missesOn=(data:Data,p:Profile,d:string,now:number,ix:Index)=>dailyRules(p.name,d).filter(r=>tone(ix.get(key(p.id,r.id,d)),d,now)==='missed').length;
export function daysWon(data:Data,now:number,ix=index(data)){
 const wins:Record<string,number>={},recent:{day:string;winner:string|null}[]=[];let ties=0;
 for(const p of data.profiles)wins[p.id]=0;
 if(data.profiles.length===2)for(const d of days()){if(!closed(d,now))break;const [a,b]=data.profiles,ma=missesOn(data,a,d,now,ix),mb=missesOn(data,b,d,now,ix),winner=ma<mb?a.id:mb<ma?b.id:null;if(winner)wins[winner]++;else ties++;recent.push({day:d,winner})}
 return {wins,ties,recent:recent.slice(-7),all:recent}}

/** Days with every daily habit done or excused, and the longest run of them. */
export function perfectDays(data:Data,p:Profile,now:number,ix=index(data)){
 const list:string[]=[];let run=0,longest=0,prev='';
 for(const d of days()){if(!closed(d,now))break;const rs=dailyRules(p.name,d);if(rs.length&&rs.every(r=>['done','excused'].includes(tone(ix.get(key(p.id,r.id,d)),d,now)))){list.push(d);run=prev===shift(d,-1)?run+1:1;longest=Math.max(longest,run);prev=d}}
 return {count:list.length,longest,first:list[0],list}}

export type Badge={id:string;title:string;how:string;earned:boolean;date?:string};
export function badges(data:Data,p:Profile,now:number,ix=index(data)):Badge[]{
 const stats=habitStats(data,p,now,ix),perfect=perfectDays(data,p,now,ix),over=closed(END,now),partner=data.profiles.find(o=>o.id!==p.id);
 let cleanWeek:string|undefined;{let run=0,prev='';for(const d of perfect.list){run=prev===shift(d,-1)?run+1:1;prev=d;if(run===7){cleanWeek=d;break}}}
 const streakDate=(n:number)=>stats.map(s=>s.reached[n]).filter(Boolean).sort()[0];
 const half=shift(START,14),halfPoints=data.points.filter(q=>q.user_id===p.id&&!q.forgiven&&!q.voided&&q.day<=half).length;
 const gymWeeks=data.weeks.filter(w=>targetFor(w,'gym')>0&&closed(w.end,now)),gymShort=gymWeeks.some(w=>weeklyDone(data,p.id,'gym',w)<targetFor(w,'gym'));
 const b=(id:string,title:string,how:string,date:string|undefined|false,earned=!!date):Badge=>({id,title,how,earned,date:date||undefined});
 // Three days won in a row (ties break the run).
 let hatTrick:string|undefined;{let run=0;for(const r of daysWon(data,now,ix).all){run=r.winner===p.id?run+1:0;if(run===3){hatTrick=r.day;break}}}
 // First closed week where the gym target was met.
 const ironWeek=gymWeeks.find(w=>weeklyDone(data,p.id,'gym',w)>=targetFor(w,'gym'))?.end;
 // The last seven days all clean.
 const finish=days(shift(END,-6),END),strongFinish=over&&finish.every(d=>perfect.list.includes(d))&&END;
 return [
  b('first_clean','First clean day','A day with nothing missed',perfect.first),
  b('clean_week','Clean week','Seven clean days in a row',cleanWeek),
  b('streak7','On a roll','Any habit, 7 days straight',streakDate(7)),
  b('streak14','Locked in','Any habit, 14 days straight',streakDate(14)),
  b('streak30','Unbroken','Any habit, all 30 days',streakDate(30)),
  b('untouchable','Untouchable','One habit with zero misses all challenge',over&&stats.some(s=>s.missed===0&&s.done>0)&&END),
  b('gym_regular','Gym regular','Every weekly gym target hit',over&&!gymShort&&END),
  b('halfway','Strong half','Fewer than five active misses by day 15',closed(half,now)&&halfPoints<5&&half),
  b('gracious','Gracious','Forgave your partner at least once',undefined,!!partner&&data.points.some(q=>q.user_id===partner.id&&q.forgiven)),
  b('hat_trick','Hat trick','Win three days in a row',hatTrick),
  b('iron_week','Iron week','Every gym visit in a week',ironWeek),
  b('strong_finish','Strong finish','The last seven days all clean',strongFinish)]}
