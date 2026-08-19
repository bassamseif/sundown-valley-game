import { describe, expect, it } from "vitest";
import {
  ORDERS,
  coinsFor,
  initialState,
  isSolved,
  nextOrderId,
  orderById,
  remaining,
  solutionFor,
  tapBowl,
  tapCoin,
  total,
} from "./marketDay";

describe("initialState", () => {
  it("puts every coin in the purse and none in the bowl", () => {
    const state = initialState("o_bread");
    expect(state.bowl).toHaveLength(0);
    expect(new Set(state.purse)).toEqual(new Set(coinsFor("o_bread").map((c) => c.id)));
  });
});

describe("tapCoin", () => {
  it("moves one coin to the bowl and raises total by its value", () => {
    const state = initialState("o_bread");
    const coin = coinsFor("o_bread")[0];
    const next = tapCoin(state, coin.id);
    expect(next.bowl).toEqual([coin.id]);
    expect(next.purse).not.toContain(coin.id);
    expect(total(next)).toBe(coin.value);
  });

  it("is a no-op on a coin already in the bowl", () => {
    const state = initialState("o_bread");
    const coin = coinsFor("o_bread")[0];
    const placed = tapCoin(state, coin.id);
    const again = tapCoin(placed, coin.id);
    expect(again).toEqual(placed);
  });
});

describe("tapBowl", () => {
  it("removes the most recently added coin, not the first or the largest", () => {
    const coins = coinsFor("o_corn"); // [5, 5, 1, 1, 1]
    let state = initialState("o_corn");
    state = tapCoin(state, coins[0].id); // 5
    state = tapCoin(state, coins[2].id); // 1 (most recent, and neither first nor largest)
    const before = state.bowl.slice();
    const after = tapBowl(state);
    expect(after.bowl).toEqual(before.slice(0, -1));
    expect(after.bowl).toEqual([coins[0].id]);
    expect(after.purse).toContain(coins[2].id);
  });

  it("is a no-op on an empty bowl", () => {
    const state = initialState("o_bread");
    const after = tapBowl(state);
    expect(after).toEqual(state);
  });
});

describe("total / remaining", () => {
  it("sums mixed denominations correctly", () => {
    const coins = coinsFor("o_cheese"); // price 7, [5, 1, 1]
    let state = initialState("o_cheese");
    for (const c of coins) state = tapCoin(state, c.id);
    expect(total(state)).toBe(7);
  });

  it("remaining is positive when underpaid, negative when overpaid, zero when exact", () => {
    const coins = coinsFor("o_cheese"); // price 7
    let state = initialState("o_cheese");
    expect(remaining(state)).toBe(7);

    state = tapCoin(state, coins[0].id); // +5
    expect(remaining(state)).toBe(2);

    state = tapCoin(state, coins[1].id); // +1 = 6
    expect(remaining(state)).toBe(1);

    state = tapCoin(state, coins[2].id); // +1 = 7, exact
    expect(remaining(state)).toBe(0);
  });

  it("overpaying is permitted — every coin can enter the bowl without an error state", () => {
    const coins = coinsFor("o_corn"); // sums to 13, price 8
    let state = initialState("o_corn");
    for (const c of coins) state = tapCoin(state, c.id);
    expect(state.purse).toHaveLength(0);
    expect(remaining(state)).toBeLessThan(0);
  });
});

describe("isSolved", () => {
  it("is true only on exact equality — one over and one under are both false", () => {
    const coins = coinsFor("o_bread"); // price 5, [5, 1, 1]
    let under = initialState("o_bread");
    expect(isSolved(under)).toBe(false);

    let exact = tapCoin(under, coins[0].id); // 5
    expect(isSolved(exact)).toBe(true);

    let over = tapCoin(exact, coins[1].id); // 6
    expect(isSolved(over)).toBe(false);
  });

  it("overpay, then tapBowl back down to exact — proves recoverability", () => {
    const coins = coinsFor("o_bread");
    let state = initialState("o_bread");
    state = tapCoin(state, coins[0].id); // 5
    state = tapCoin(state, coins[1].id); // 6 — overpaid
    expect(isSolved(state)).toBe(false);
    state = tapBowl(state); // back to 5
    expect(isSolved(state)).toBe(true);
  });
});

describe("content", () => {
  it("every order is payable exactly from its own purse", () => {
    for (const order of ORDERS) {
      const solution = solutionFor(order.id);
      let state = initialState(order.id);
      for (const id of solution) state = tapCoin(state, id);
      expect(isSolved(state)).toBe(true);
    }
  });

  it("no order's price exceeds 20, and no order needs more than six coins to solve", () => {
    for (const order of ORDERS) {
      expect(order.price).toBeLessThanOrEqual(20);
      expect(solutionFor(order.id).length).toBeLessThanOrEqual(6);
    }
  });

  it("orderById throws on an unknown id", () => {
    expect(() => orderById("nope")).toThrow();
  });
});

describe("nextOrderId", () => {
  it("cycles to the next order and wraps around", () => {
    const first = ORDERS[0].id;
    const second = ORDERS[1].id;
    expect(nextOrderId(initialState(first))).toBe(second);

    const last = ORDERS[ORDERS.length - 1].id;
    expect(nextOrderId(initialState(last))).toBe(first);
  });
});
