import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  chargesPerYear,
  diffDays,
  fromEpochDay,
  isLocalDate,
  monthlyEquivalent,
  nextOccurrence,
  occurrenceAt,
  previousOccurrence,
  toEpochDay,
  type BillingCycle,
} from "../src/index.js";

const monthly: BillingCycle = { unit: "month", every: 1 };
const yearly: BillingCycle = { unit: "year", every: 1 };

describe("local dates", () => {
  it("validates real calendar dates only", () => {
    expect(isLocalDate("2024-02-29")).toBe(true);
    expect(isLocalDate("2023-02-29")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-1-01")).toBe(false);
  });

  it("round-trips epoch days across centuries", () => {
    for (const d of ["1970-01-01", "1999-12-31", "2000-02-29", "2026-10-04", "2100-03-01"]) {
      expect(fromEpochDay(toEpochDay(d))).toBe(d);
    }
    expect(toEpochDay("1970-01-01")).toBe(0);
  });

  it("matches Date.UTC for every day in a 4-year span", () => {
    for (let n = toEpochDay("2023-01-01"); n < toEpochDay("2027-01-01"); n++) {
      expect(fromEpochDay(n)).toBe(new Date(n * 86_400_000).toISOString().slice(0, 10));
    }
  });

  it("adds days and months with clamping", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-10-04", "2026-11-01")).toBe(28);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("billing cycles", () => {
  it("keeps the anchor day after a short month", () => {
    expect(occurrenceAt("2026-01-31", monthly, 1)).toBe("2026-02-28");
    expect(occurrenceAt("2026-01-31", monthly, 2)).toBe("2026-03-31");
  });

  it("handles Feb 29 yearly anchors", () => {
    expect(occurrenceAt("2024-02-29", yearly, 1)).toBe("2025-02-28");
    expect(occurrenceAt("2024-02-29", yearly, 4)).toBe("2028-02-29");
  });

  it("finds the next charge on or after a date", () => {
    expect(nextOccurrence("2026-01-31", monthly, "2026-02-01")).toBe("2026-02-28");
    expect(nextOccurrence("2026-01-31", monthly, "2026-02-28")).toBe("2026-02-28");
    expect(nextOccurrence("2026-01-31", monthly, "2026-03-01")).toBe("2026-03-31");
    expect(nextOccurrence("2026-05-10", monthly, "2026-01-01")).toBe("2026-05-10");
    expect(nextOccurrence("2020-06-15", yearly, "2026-10-04")).toBe("2027-06-15");
    expect(nextOccurrence("2026-09-01", { unit: "week", every: 2 }, "2026-10-04")).toBe("2026-10-13");
    expect(nextOccurrence("2026-10-01", { unit: "day", every: 30 }, "2026-10-31")).toBe("2026-10-31");
  });

  it("agrees with brute force for month-based cycles", () => {
    const cycles: BillingCycle[] = [monthly, { unit: "month", every: 3 }, yearly, { unit: "month", every: 7 }];
    for (const cycle of cycles) {
      for (const anchor of ["2025-01-31", "2024-02-29", "2025-08-30"]) {
        const all = Array.from({ length: 120 }, (_, k) => occurrenceAt(anchor, cycle, k));
        for (let d = toEpochDay("2025-01-01"); d < toEpochDay("2031-01-01"); d += 3) {
          const date = fromEpochDay(d);
          expect(nextOccurrence(anchor, cycle, date)).toBe(all.find((o) => o >= date));
        }
      }
    }
  });

  it("reports the previous charge", () => {
    expect(previousOccurrence("2026-01-15", monthly, "2026-01-15")).toBeNull();
    expect(previousOccurrence("2026-01-15", monthly, "2026-03-16")).toBe("2026-03-15");
    expect(previousOccurrence("2026-01-15", monthly, "2026-03-15")).toBe("2026-02-15");
  });

  it("normalises cost to a monthly figure", () => {
    expect(monthlyEquivalent(12000, yearly)).toBe(1000);
    expect(monthlyEquivalent(3000, { unit: "month", every: 3 })).toBe(1000);
    expect(chargesPerYear({ unit: "week", every: 1 })).toBe(52);
  });
});
