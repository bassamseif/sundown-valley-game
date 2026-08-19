// Pay the exact price with coins of one and five — the deterministic
// core of Market Day. Pure TypeScript, mirrors soundForge.ts and
// pipeAlign.ts: no React, no Three.js.
import orderData from "../../../../content/puzzles/marketDay.json";

export type CoinValue = 1 | 5;

export interface Coin {
  id: string;
  value: CoinValue;
}

export interface OrderDef {
  id: string;
  price: number;
  itemModelId: string;
  purse: CoinValue[];
}

export interface MarketState {
  orderId: string;
  purse: string[]; // coin ids still in the purse
  bowl: string[]; // coin ids in the bowl, in tap order
}

export const ORDERS: OrderDef[] = orderData.orders as OrderDef[];

export function orderById(id: string): OrderDef {
  const order = ORDERS.find((o) => o.id === id);
  if (!order) throw new Error(`Unknown order id: ${id}`);
  return order;
}

export function coinsFor(orderId: string): Coin[] {
  const order = orderById(orderId);
  return order.purse.map((value, i) => ({ id: `${orderId}_c${i}`, value }));
}

export function initialState(orderId: string): MarketState {
  const coins = coinsFor(orderId);
  return {
    orderId,
    purse: coins.map((c) => c.id),
    bowl: [],
  };
}

export function tapCoin(state: MarketState, coinId: string): MarketState {
  if (state.bowl.includes(coinId)) return state; // already in the bowl — no-op
  const purseIndex = state.purse.indexOf(coinId);
  if (purseIndex === -1) return state; // not a coin for this order

  const purse = state.purse.slice();
  purse.splice(purseIndex, 1);
  return { ...state, purse, bowl: [...state.bowl, coinId] };
}

export function tapBowl(state: MarketState): MarketState {
  if (state.bowl.length === 0) return state; // empty bowl — no-op

  const bowl = state.bowl.slice(0, -1);
  const returned = state.bowl[state.bowl.length - 1];
  return { ...state, bowl, purse: [...state.purse, returned] };
}

function valueById(orderId: string): Map<string, CoinValue> {
  return new Map(coinsFor(orderId).map((c) => [c.id, c.value]));
}

export function total(state: MarketState): number {
  const values = valueById(state.orderId);
  return state.bowl.reduce((sum, id) => sum + (values.get(id) ?? 0), 0);
}

export function remaining(state: MarketState): number {
  return orderById(state.orderId).price - total(state);
}

export function isSolved(state: MarketState): boolean {
  return total(state) === orderById(state.orderId).price;
}

export function nextOrderId(state: MarketState): string {
  const index = ORDERS.findIndex((o) => o.id === state.orderId);
  return ORDERS[(index + 1) % ORDERS.length].id;
}

// A coin-id list that pays the price exactly, taking coins in the
// order they appear in the purse — used by the test hook so an e2e
// test can solve an order without re-deriving a subset-sum itself,
// and by the unit suite to prove every order is payable at all (I7).
export function solutionFor(orderId: string): string[] {
  const coins = coinsFor(orderId);
  const price = orderById(orderId).price;

  const solve = (index: number, remainingAmount: number): string[] | null => {
    if (remainingAmount === 0) return [];
    if (index >= coins.length || remainingAmount < 0) return null;

    const withCoin = solve(index + 1, remainingAmount - coins[index].value);
    if (withCoin) return [coins[index].id, ...withCoin];
    return solve(index + 1, remainingAmount);
  };

  const result = solve(0, price);
  if (!result) throw new Error(`Order ${orderId} has no exact-payment subset in its purse`);
  return result;
}
