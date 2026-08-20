import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import {
  ORDERS,
  coinsFor,
  initialState,
  isSolved,
  nextOrderId,
  orderById,
  remaining as remainingOf,
  solutionFor,
  tapBowl,
  tapCoin,
  total as totalOf,
  type MarketState,
} from "../puzzles/marketDay";
import { exposeTestHook } from "../engine/testHooks";
import { track } from "../engine/analytics";
import { BalanceBeam } from "./market/BalanceBeam";
import { Coin } from "./market/Coin";
import { COIN_Y, COUNTER_Y, PLATTER_RADIUS, PURSE_Z, footprintRadius, packOnPlatter } from "./market/layout";

// Fallback hint affordance: if the player goes idle for a couple
// seconds without the move that's actually needed, glow whatever they
// should touch next. Two distinct situations, each with its own
// once-ever gate (localStorage-persisted) — firing one doesn't use up
// the other, but neither ever nags twice:
//   - underpaid (or exact-but-unsolved... isSolved handles exact, so
//     really just "still owes money"): glow the next coin to tap, on
//     the purse tray.
//   - overpaid: glow the paid platter itself — the thing to tap to
//     give a coin back — since the player hasn't discovered tapping
//     the bowl removes the most recent coin.
// Per Montessori "control of error": the material teaches the concept
// once via a highlight, then gets out of the way — it doesn't keep
// pointing at the answer on every later attempt.
const HINT_IDLE_MS = 2500;
const HINT_TAP_SEEN_KEY = "sv_market_hint_tap_seen";
const HINT_RETURN_SEEN_KEY = "sv_market_hint_return_seen";

export function MarketDayScene() {
  const [state, setState] = useState<MarketState>(() => initialState(ORDERS[0].id));
  const solved = useMemo(() => isSolved(state), [state]);
  const order = orderById(state.orderId);
  const coins = useMemo(() => coinsFor(state.orderId), [state.orderId]);
  const solution = useMemo(() => solutionFor(state.orderId), [state.orderId]);

  const total = totalOf(state);
  const remaining = remainingOf(state);
  const diffRef = useRef(0);
  diffRef.current = total - order.price;

  function handleCoinTap(coinId: string) {
    if (solved) return;
    setState((s) => tapCoin(s, coinId));
  }

  function handleBowlTap() {
    setState((s) => tapBowl(s));
  }

  function nextOrder() {
    track("market_next_order", { orderId: state.orderId });
    setState(initialState(nextOrderId(state)));
  }

  useEffect(() => {
    if (solved) track("market_order_solved", { orderId: state.orderId, price: order.price, coinCount: state.bowl.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  useEffect(() => {
    exposeTestHook("market", {
      tapCoin: handleCoinTap,
      tapBowl: handleBowlTap,
      reset: () => setState(initialState(state.orderId)),
      nextOrder,
      state,
      total,
      remaining,
      solved,
      solution,
    });
  });

  const [hintTapActive, setHintTapActive] = useState(false);
  const [hintReturnActive, setHintReturnActive] = useState(false);
  const tapSeenRef = useRef(typeof window !== "undefined" && localStorage.getItem(HINT_TAP_SEEN_KEY) === "1");
  const returnSeenRef = useRef(typeof window !== "undefined" && localStorage.getItem(HINT_RETURN_SEEN_KEY) === "1");
  const overpaid = remaining < 0;

  // Restarts on every tap (state changes identity on every setState) —
  // a fresh idle window opens after each move, judged against whatever
  // the situation is right then (underpaid vs. overpaid), and only the
  // matching hint's own once-ever gate can suppress it.
  useEffect(() => {
    setHintTapActive(false);
    setHintReturnActive(false);
    if (solved) return;
    if (overpaid ? returnSeenRef.current : tapSeenRef.current) return;

    const timer = setTimeout(() => {
      if (overpaid) {
        setHintReturnActive(true);
        returnSeenRef.current = true;
        localStorage.setItem(HINT_RETURN_SEEN_KEY, "1");
        track("market_hint_shown", { kind: "return" });
      } else {
        setHintTapActive(true);
        tapSeenRef.current = true;
        localStorage.setItem(HINT_TAP_SEEN_KEY, "1");
        track("market_hint_shown", { kind: "tap" });
      }
    }, HINT_IDLE_MS);
    return () => clearTimeout(timer);
  }, [state, solved, overpaid]);

  const nextHintCoinId = hintTapActive ? solution.find((id) => !state.bowl.includes(id)) : undefined;

  const purseCoins = coins.filter((c) => state.purse.includes(c.id));
  const bowlCoins = state.bowl.map((id) => coins.find((c) => c.id === id)!);
  const angleRef = useRef(0);

  // Sized off the order's FULL coin list (coins.length), not the
  // currently-tapped bowlCoins.length — every coin that could ever land
  // on the platter is already known up front, so the ring layout (and
  // thus each slot's position) stays fixed as coins are tapped in and
  // out, the same "index alone" stability packOnPlatter documents.
  const paidMaxR = footprintRadius(coins.some((c) => c.value === 5) ? 5 : 1);
  const paidPositions = useMemo(() => packOnPlatter(coins.length, paidMaxR, PLATTER_RADIUS), [coins.length, paidMaxR]);

  const trayR1 = Math.max(0.6, ((coins.length - 1) * 0.55) / 2 + 0.4);
  const trayR2 = Math.max(0.5, ((coins.length - 1) * 0.55) / 2 + 0.3);

  return (
    <group>
      <BalanceBeam
        diffRef={diffRef}
        angleRef={angleRef}
        price={order.price}
        rightPlatterGlowing={hintReturnActive}
        onRightPlatterTap={handleBowlTap}
      />

      {/* purse tray — same material/finish as the scale's platters, so
          the coins have a surface to visibly rest on instead of
          appearing to float or sink into the sand. Doesn't join the
          "tap a coin" hint itself — that hint points at one specific
          coin (see nextHintCoinId below), and glowing the whole tray
          on top of that would point at every coin on it, not the one
          that actually matters. */}
      <mesh position={[0, COIN_Y - 0.02, PURSE_Z]} receiveShadow>
        <cylinderGeometry args={[trayR1, trayR2, 0.04, 32]} />
        <meshStandardMaterial color="#d8c6a0" roughness={0.6} metalness={0.05} />
      </mesh>

      {/* Every coin for this order, purse and bowl together, in ONE
          array rendered by ONE .map() — not two separate {arr.map()}
          blocks. React implicitly wraps each separate {array.map(...)}
          expression in its own Fragment; a key that moves from one such
          expression to another is reconciled as leaving one Fragment
          and entering a different one, so React unmounts the old fiber
          and mounts a brand new one even though the key matches — which
          is exactly the "disappears and reappears" bug. A single
          combined array keeps every coin in the same Fragment for its
          entire life, so tapping one only ever changes its `anchor`
          prop on the same live instance (see Coin for how that becomes
          one continuous, undamped-nowhere motion). Purse slots are
          keyed off each coin's fixed index in the order's full coin
          list, not its index within the filtered purseCoins array —
          that array's length shrinks every time a coin is tapped, which
          would recenter and jump every remaining coin instead of
          animating only the one just tapped. */}
      {[
        ...purseCoins.map((c) => {
          const fixedIndex = coins.findIndex((oc) => oc.id === c.id);
          return {
            id: c.id,
            value: c.value,
            anchor: { kind: "purse" as const, pos: [(fixedIndex - (coins.length - 1) / 2) * 0.55, COIN_Y, PURSE_Z] as const },
            onTap: () => handleCoinTap(c.id),
            scale: 1.3,
            hinted: c.id === nextHintCoinId,
            // Pop in one after another rather than all at once — timed
            // to start as the camera's fly-in into this loop (see
            // SceneShell's CameraRig) is finishing, not while it's
            // still moving.
            appearDelay: 1.3 + fixedIndex * 0.12,
          };
        }),
        ...bowlCoins.map((c, i) => ({
          id: c.id,
          value: c.value,
          anchor: { kind: "platter" as const, side: "right" as const, local: paidPositions[i], angleRef },
          // Returning a coin is a tray action now (tap the platter
          // itself — see BalanceBeam's onRightPlatterTap), not a
          // per-coin one, so a landed coin isn't its own tap target.
          onTap: undefined,
          scale: 1,
          hinted: false,
        })),
      ].map((cr) => <Coin key={cr.id} value={cr.value} anchor={cr.anchor} onTap={cr.onTap} scale={cr.scale} hinted={cr.hinted} />)}

      {solved && (
        <Html position={[0, COUNTER_Y + 1.05, 0.55]} center>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: "16px 22px",
              borderRadius: 18,
              background: "rgba(26, 31, 46, 0.75)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ color: "#fff3e0", fontSize: 15, fontWeight: 600 }}>Paid exactly!</div>
            <button
              onClick={nextOrder}
              style={{
                padding: "10px 22px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #ffd27f, #ff9d7f)",
                color: "#2b2114",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
              }}
            >
              Next order →
            </button>
          </div>
        </Html>
      )}
    </group>
  );
}
