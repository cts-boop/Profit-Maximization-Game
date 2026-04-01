// ============================================================
// Core Economic Engine - 決戰邊際：奶茶大亨 (Marginal Tycoon)
// v3.0 — Scalable N groups (2–12), dynamic demand formula
// ============================================================

const GameEngine = {

  // ── Default Parameters ──
  DEFAULT_FC: 20,
  MAX_ROUNDS: 6,
  DEFAULT_TIMER_SECONDS: 120,
  MIN_GROUPS: 2,
  MAX_GROUPS: 12,

  // ── All 12 Possible Team Slots ──
  ALL_TEAMS: [
    { id: "teamA", name: "Group A", emoji: "🟤" },
    { id: "teamB", name: "Group B", emoji: "⚫" },
    { id: "teamC", name: "Group C", emoji: "🟡" },
    { id: "teamD", name: "Group D", emoji: "🟢" },
    { id: "teamE", name: "Group E", emoji: "🟣" },
    { id: "teamF", name: "Group F", emoji: "🔴" },
    { id: "teamG", name: "Group G", emoji: "🔵" },
    { id: "teamH", name: "Group H", emoji: "🟠" },
    { id: "teamI", name: "Group I", emoji: "⚪" },
    { id: "teamJ", name: "Group J", emoji: "🩷" },
    { id: "teamK", name: "Group K", emoji: "🩵" },
    { id: "teamL", name: "Group L", emoji: "🟩" }
  ],

  /** Return first N teams from ALL_TEAMS. */
  getTeams(n) {
    n = Math.max(this.MIN_GROUPS, Math.min(this.MAX_GROUPS, n || 5));
    return this.ALL_TEAMS.slice(0, n);
  },

  // Legacy accessor (defaults to 5 for backward compat)
  get TEAMS() { return this.getTeams(5); },

  // ── Production & Cost Data Table (Q-based) ──
  // Since ΔQ = 1, MC = ΔTC exactly. U-shaped MC confirms LDMR.
  Q_TABLE: [
    { q: 0, fc: 20, vc: 0,   tc: 20,  mc: null },
    { q: 1, fc: 20, vc: 10,  tc: 30,  mc: 10   },
    { q: 2, fc: 20, vc: 15,  tc: 35,  mc: 5    },
    { q: 3, fc: 20, vc: 25,  tc: 45,  mc: 10   },
    { q: 4, fc: 20, vc: 40,  tc: 60,  mc: 15   },
    { q: 5, fc: 20, vc: 60,  tc: 80,  mc: 20   },
    { q: 6, fc: 20, vc: 90,  tc: 110, mc: 30   },
    { q: 7, fc: 20, vc: 130, tc: 150, mc: 40   },
    { q: 8, fc: 20, vc: 180, tc: 200, mc: 50   }
  ],

  // ── Dynamic Demand Engine (v3.0) ──
  // Tiers scale with N (number of groups):
  //   Q < 4N  → $30 Shortage
  //   4N ≤ Q < 5N → $20 Equilibrium
  //   5N ≤ Q < 6N → $15 Surplus
  //   Q ≥ 6N → $10 Market Crash
  DEMAND_TIERS: [
    { mult: 4, price: 30, description: "供應短缺 (Shortage)" },
    { mult: 5, price: 20, description: "市場均衡 (Equilibrium)" },
    { mult: 6, price: 15, description: "供應過剩 (Surplus)" }
    // Q ≥ 6N falls through to crash
  ],

  // ── Event Cards (Teacher-triggered, Global) ──
  // vc_shock modifier = extra cost per unit of Q produced (shifts MC by same amount).
  EVENTS: [
    { event_id: "E01", name: "業主加租",           type: "fc_shock", target: "fc",         modifier: 10,  desc: "租金(FC)增加 $10！(考點: FC不影響MC)",                    icon: "🏠📈" },
    { event_id: "E02", name: "租金津貼",           type: "fc_shock", target: "fc",         modifier: -10, desc: "租金(FC)減少 $10！",                                      icon: "🏠📉" },
    { event_id: "E03", name: "材料費上漲",         type: "vc_shock", target: "vc_per_unit", modifier: 5,   desc: "每件產品的可變成本(VC)增加 $5！(考點: MC全面上升，需減產)", icon: "💰📈" },
    { event_id: "E04", name: "技術進步",           type: "vc_shock", target: "vc_per_unit", modifier: -2,  desc: "每件產品的可變成本(VC)減少 $2！",                         icon: "🍵📉" },
    { event_id: "E05", name: "天價續租 (陷阱卡)",  type: "fc_shock", target: "fc",         modifier: 50,  desc: "租金(FC)暴增 $50！(考點: 虧損下繼續生產 TR > TVC)",       icon: "💀🏠" },
    { event_id: "E06", name: "供應鏈斷裂 (陷阱卡)",type: "vc_shock", target: "vc_per_unit", modifier: 25,  desc: "每件產品的可變成本(VC)暴增 $25！(考點: 跌穿停產點，應將Q設為0)", icon: "💀🍵" }
  ],

  // ── Item Shop (Team-purchased, Local) ──
  ITEMS: [
    { item_id: "I01", name: "精準市場調查", cost: 5,  effect: "reveal_demand", modifier: 0,  desc: "解鎖本回合真實的需求預測階梯表", icon: "🔍" },
    { item_id: "I02", name: "自動化設備",   cost: 15, effect: "reduce_vc",     modifier: -2, desc: "本回合每件產品可變成本減少 $2", icon: "🤖" },
    { item_id: "I04", name: "品牌忠誠度",   cost: 20, effect: "price_premium", modifier: 3,  desc: "產品無視市價崩盤，結算時享 $3 溢價", icon: "⭐" }
  ],

  // ============================================================
  // Calculation Functions
  // ============================================================

  /** Get base VC for a given Q (before events/items). */
  getBaseVC(q) {
    if (q < 0 || q > 8) return 0;
    return this.Q_TABLE[q].vc;
  },

  /** Get base MC for a given Q (before events/items). */
  getBaseMC(q) {
    if (q <= 0 || q > 8) return null;
    return this.Q_TABLE[q].mc;
  },

  /** Get effective FC after applying fc_shock events. */
  getEffectiveFC(activeEvents) {
    let fc = this.DEFAULT_FC;
    if (activeEvents) {
      for (const evt of activeEvents) {
        if (evt.target === "fc") fc += evt.modifier;
      }
    }
    return Math.max(0, fc);
  },

  /**
   * Get total VC modifier per unit from vc_shock events and reduce_vc items.
   * Effective VC at Q = base_vc[Q] + Q × vcModifier
   * Effective MC at Q = base_mc[Q] + vcModifier
   */
  getVCModifier(activeEvents, activeItems) {
    let mod = 0;
    if (activeEvents) {
      for (const evt of activeEvents) {
        if (evt.target === "vc_per_unit") mod += evt.modifier;
      }
    }
    if (activeItems) {
      for (const item of activeItems) {
        if (item.effect === "reduce_vc") mod += item.modifier; // negative
      }
    }
    return mod;
  },

  /** Get effective VC at Q (including event/item adjustments). */
  getEffectiveVC(q, activeEvents, activeItems) {
    const baseVC = this.getBaseVC(q);
    const mod = this.getVCModifier(activeEvents, activeItems);
    return Math.max(0, baseVC + q * mod);
  },

  /** Get effective TC at Q. */
  getEffectiveTC(q, activeEvents, activeItems) {
    return this.getEffectiveFC(activeEvents) + this.getEffectiveVC(q, activeEvents, activeItems);
  },

  /** Get effective MC at Q (base MC + vc_per_unit modifier). */
  getEffectiveMC(q, activeEvents, activeItems) {
    if (q <= 0 || q > 8) return null;
    const baseMC = this.Q_TABLE[q].mc;
    const mod = this.getVCModifier(activeEvents, activeItems);
    return baseMC + mod;
  },

  /** Get price premium from items. */
  getPricePremium(activeItems) {
    let premium = 0;
    if (activeItems) {
      for (const item of activeItems) {
        if (item.effect === "price_premium") premium += item.modifier;
      }
    }
    return premium;
  },

  /** Determine market price from total supply and number of groups N (dynamic formula). */
  getMarketPrice(totalSupply, N) {
    N = N || 5;
    if (totalSupply < 4 * N) return { price: 30, description: "供應短缺 (Shortage)" };
    if (totalSupply < 5 * N) return { price: 20, description: "市場均衡 (Equilibrium)" };
    if (totalSupply < 6 * N) return { price: 15, description: "供應過剩 (Surplus)" };
    return { price: 10, description: "市場崩盤 (Market Crash)" };
  },

  /** Get the demand tier table for display, given N. */
  getDemandTable(N) {
    N = N || 5;
    return [
      { range: `0 – ${4 * N - 1}`, price: 30, desc: "供應短缺" },
      { range: `${4 * N} – ${5 * N - 1}`, price: 20, desc: "市場均衡" },
      { range: `${5 * N} – ${6 * N - 1}`, price: 15, desc: "供應過剩" },
      { range: `${6 * N}+`, price: 10, desc: "市場崩盤" }
    ];
  },

  /** Calculate full result for a single team. */
  calculateTeamResult(q, activeEvents, activeItems, marketPrice) {
    const effectiveFC = this.getEffectiveFC(activeEvents);
    const pricePremium = this.getPricePremium(activeItems);
    const vc = this.getEffectiveVC(q, activeEvents, activeItems);
    const tc = effectiveFC + vc;
    const finalPrice = marketPrice + pricePremium;
    const tr = q * finalPrice;
    const profit = tr - tc;
    const mc = this.getEffectiveMC(q, activeEvents, activeItems);

    // Over-production: MC at chosen Q > market price
    const overproduction = (q > 0 && mc !== null && mc > marketPrice);
    // Shutdown point: TR < TVC while still producing
    const belowShutdown = (q > 0 && tr < vc);

    return { q, tp: q, effectiveFC, vc, tc, marketPrice, pricePremium, finalPrice, tr, profit, mc, overproduction, belowShutdown };
  },

  /**
   * Run full clearing calculation for a round.
   * teamsData: array of { teamId, q, activeItems }
   * N: number of groups (used for dynamic demand formula)
   */
  clearRound(teamsData, activeEvents, N) {
    let totalSupply = 0;
    for (const team of teamsData) totalSupply += (team.q || 0);

    const market = this.getMarketPrice(totalSupply, N);

    const teamResults = {};
    for (const team of teamsData) {
      teamResults[team.teamId] = this.calculateTeamResult(
        team.q || 0, activeEvents, team.activeItems || [], market.price
      );
    }

    return { totalSupply, marketPrice: market.price, marketDescription: market.description, teamResults };
  }
};
