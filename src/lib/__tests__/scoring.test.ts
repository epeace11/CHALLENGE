import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  challengeWeeks, daysRemaining, defaultLogDate, dollarsFor, isLocked, lockAt, ruleAppliesTo, weekBounds, weeklyShortfall,
} from "../scoring";
import type { Challenge, Rule } from "../types";

const challenge: Challenge = {
  id: "c", name: "September Challenge", start_date: "2026-09-08", end_date: "2026-09-30",
  timezone: "America/Toronto", log_deadline_time: "12:00:00", dispute_window_hours: 48,
  unlogged_policy: "all_missed", created_at: "",
};

const rule = (over: Partial<Rule>): Rule => ({
  id: "r", challenge_id: "c", sort_order: 1, title: "t", description: "", cadence: "daily", applies_to: "both",
  active_days: [0, 1, 2, 3, 4, 5, 6], weekly_target: null, proof_required: false, ...over,
});

const toronto = (iso: string) => DateTime.fromISO(iso, { zone: "America/Toronto" });

describe("money", () => {
  it("charges $n for the n-th point", () => {
    expect(dollarsFor(0)).toBe(0);
    expect(dollarsFor(1)).toBe(1);
    expect(dollarsFor(3)).toBe(6);
    expect(dollarsFor(5)).toBe(15);
    expect(dollarsFor(7)).toBe(28);
  });
});

describe("weekly shortfall", () => {
  it("is target minus done, floored at zero", () => {
    expect(weeklyShortfall(4, 3)).toBe(1);
    expect(weeklyShortfall(4, 1)).toBe(3);
    expect(weeklyShortfall(4, 0)).toBe(4);
    expect(weeklyShortfall(4, 6)).toBe(0);
  });
});

describe("rule applicability", () => {
  const weeknights = rule({ active_days: [0, 1, 2, 3, 4] });
  it("treats Sun–Thu as weeknights", () => {
    expect(ruleAppliesTo(weeknights, "erin", "2026-09-13")).toBe(true); // Sunday
    expect(ruleAppliesTo(weeknights, "erin", "2026-09-17")).toBe(true); // Thursday
    expect(ruleAppliesTo(weeknights, "erin", "2026-09-18")).toBe(false); // Friday
    expect(ruleAppliesTo(weeknights, "erin", "2026-09-19")).toBe(false); // Saturday
  });
  it("respects applies_to", () => {
    expect(ruleAppliesTo(rule({ applies_to: "erin" }), "kazzy", "2026-09-10")).toBe(false);
    expect(ruleAppliesTo(rule({ applies_to: "erin" }), "erin", "2026-09-10")).toBe(true);
  });
  it("weekly rules ignore active_days", () => {
    expect(ruleAppliesTo(rule({ cadence: "weekly", weekly_target: 4, active_days: [] }), "erin", "2026-09-19")).toBe(true);
  });
});

describe("locking", () => {
  it("locks at noon Toronto the following day", () => {
    const at = lockAt(challenge, "2026-09-10");
    expect(at.toISO()).toBe(toronto("2026-09-11T12:00:00").toISO());
    expect(at.toUTC().hour).toBe(16); // EDT is UTC-4
  });
  it("is open before the deadline and locked after", () => {
    expect(isLocked(challenge, "2026-09-10", toronto("2026-09-11T11:59:00"))).toBe(false);
    expect(isLocked(challenge, "2026-09-10", toronto("2026-09-11T12:00:00"))).toBe(true);
  });
  it("honours a reopen window", () => {
    const reopen = toronto("2026-09-15T09:00:00").toISO()!;
    expect(isLocked(challenge, "2026-09-10", toronto("2026-09-14T20:00:00"), reopen)).toBe(false);
    expect(isLocked(challenge, "2026-09-10", toronto("2026-09-15T09:01:00"), reopen)).toBe(true);
  });
});

describe("default log date", () => {
  it("is yesterday before noon and today after", () => {
    expect(defaultLogDate(challenge, toronto("2026-09-12T08:00:00"))).toBe("2026-09-11");
    expect(defaultLogDate(challenge, toronto("2026-09-12T12:30:00"))).toBe("2026-09-12");
  });
  it("clamps to the challenge range", () => {
    expect(defaultLogDate(challenge, toronto("2026-09-08T08:00:00"))).toBe("2026-09-08");
    expect(defaultLogDate(challenge, toronto("2026-10-05T08:00:00"))).toBe("2026-09-30");
  });
});

describe("weeks", () => {
  it("runs Sunday to Saturday", () => {
    expect(weekBounds("2026-09-09")).toEqual({ start: "2026-09-06", end: "2026-09-12" });
    expect(weekBounds("2026-09-13")).toEqual({ start: "2026-09-13", end: "2026-09-19" });
  });
  it("clips the first and last challenge weeks", () => {
    expect(challengeWeeks(challenge)).toEqual([
      { start: "2026-09-08", end: "2026-09-12" },
      { start: "2026-09-13", end: "2026-09-19" },
      { start: "2026-09-20", end: "2026-09-26" },
      { start: "2026-09-27", end: "2026-09-30" },
    ]);
  });
});

describe("days remaining", () => {
  it("counts today through the end date", () => {
    expect(daysRemaining(challenge, toronto("2026-09-08T10:00:00"))).toBe(23);
    expect(daysRemaining(challenge, toronto("2026-09-30T10:00:00"))).toBe(1);
    expect(daysRemaining(challenge, toronto("2026-10-01T10:00:00"))).toBe(0);
  });
});
