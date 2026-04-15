// ============================================================
// Core Economic Engine - 決戰邊際：奶茶大亨 (Marginal Tycoon)
// v4.0 — Dual Modes: Price Taker (完全競爭) & Interactive Market (寡頭博弈)
// ============================================================

const GameEngine = {

  // ── Game Modes ──
  MODE_PRICE_TAKER: 1,   // 完全競爭: teacher sets fixed price
  MODE_INTERACTIVE: 2,   // 寡頭博弈: dynamic supply-demand pricing

  // ── Default Parameters ──
  DEFAULT_FC: 20,
  MAX_ROUNDS: 6,
  DEFAULT_TIMER_SECONDS: 120,
  MIN_GROUPS: 2,
  MAX_GROUPS: 12,
  HEDGE_SAFE_PRICE: 15,

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

  // ── Dynamic Demand (v4.0) ──
  // Mode 2 equilibrium buffer: upper limit = (5N + ⌊N/2⌋)
  // Mode 1 (Price Taker): teacher sets fixed price, demand formula not used

  // ── Event Cards (4 Simplified, Teacher-triggered, Global) ──
  EVENTS: [
    { event_id: "E01", name: "業主加租",           type: "fc_shock", target: "fc",         modifier: 10, desc: "租金增加 $10！",                icon: "🏠📈" },
    { event_id: "E02", name: "材料費上漲",         type: "vc_shock", target: "vc_per_unit", modifier: 5,  desc: "每件產品的工資成本增加 $5！",   icon: "💰📈" },
    { event_id: "E03", name: "天價續租 (陷阱卡)",  type: "fc_shock", target: "fc",         modifier: 50, desc: "租金暴增 $50！",                icon: "💀🏠" },
    { event_id: "E04", name: "供應鏈斷裂 (陷阱卡)",type: "vc_shock", target: "vc_per_unit", modifier: 25, desc: "每件產品的工資成本暴增 $25！",  icon: "💀🍵" }
  ],

  // ── Item Shop (Mode 2 only: single radar item) ──
  ITEMS: [
    { item_id: "I_RADAR", name: "資訊雷達", cost: 30, effect: "radar", modifier: 0, desc: "本回合購買，下回合啟用：即時顯示全班產量動態", icon: "📡" }
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

  /** Determine market price from total supply, N groups, and game mode. */
  getMarketPrice(totalSupply, N, mode) {
    N = N || 5;
    const eqUpper = (mode === 2) ? (5 * N) + Math.floor(N / 2) : 5 * N;
    if (totalSupply < 4 * N) return { price: 30, description: "供應短缺 (Shortage)" };
    if (totalSupply < eqUpper) return { price: 20, description: "市場均衡 (Equilibrium)" };
    if (totalSupply < 6 * N) return { price: 15, description: "供應過剩 (Surplus)" };
    return { price: 10, description: "市場崩盤 (Market Crash)" };
  },

  /** Get the demand tier table for display, given N and game mode. */
  getDemandTable(N, mode) {
    N = N || 5;
    const eqUpper = (mode === 2) ? (5 * N) + Math.floor(N / 2) : 5 * N;
    return [
      { range: `0 – ${4 * N - 1}`, price: 30, desc: "供應短缺" },
      { range: `${4 * N} – ${eqUpper - 1}`, price: 20, desc: "市場均衡" },
      { range: `${eqUpper} – ${6 * N - 1}`, price: 15, desc: "供應過剩" },
      { range: `${6 * N}+`, price: 10, desc: "市場崩盤" }
    ];
  },

  /** Calculate full result for a single team (supports hedging). */
  calculateTeamResult(q, activeEvents, activeItems, marketPrice, hedgeQ) {
    const effectiveFC = this.getEffectiveFC(activeEvents);
    const pricePremium = this.getPricePremium(activeItems);
    const vc = this.getEffectiveVC(q, activeEvents, activeItems);
    const tc = effectiveFC + vc;
    const finalPrice = marketPrice + pricePremium;

    const hq = (hedgeQ !== undefined && hedgeQ > 0) ? Math.min(hedgeQ, q) : 0;
    let tr;
    if (hq > 0) {
      tr = (hq * this.HEDGE_SAFE_PRICE) + ((q - hq) * finalPrice);
    } else {
      tr = q * finalPrice;
    }

    const profit = tr - tc;
    const mc = this.getEffectiveMC(q, activeEvents, activeItems);
    const overproduction = (q > 0 && mc !== null && mc > marketPrice);
    const belowShutdown = (q > 0 && tr < vc);
    const hedgeSuccess = (hq > 0 && marketPrice < this.HEDGE_SAFE_PRICE);

    return { q, tp: q, effectiveFC, vc, tc, marketPrice, pricePremium, finalPrice, tr, profit, mc, overproduction, belowShutdown, hedgeQ: hq, hedgeSuccess };
  },

  /**
   * Find the profit-maximizing Q given market price and cost structure.
   * Reconstructs the VC modifier from actual vc/q data, then evaluates
   * profit at each Q from 0–8 to find the optimum.
   * Returns { optimalQ, maxProfit }.
   */
  getOptimalQ(marketPrice, fc, actualQ, actualVC) {
    let vcModifier = 0;
    if (actualQ > 0) {
      const baseVC = this.getBaseVC(actualQ);
      vcModifier = (actualVC - baseVC) / actualQ;
    }
    let bestQ = 0;
    let bestProfit = -fc; // profit at Q=0
    for (let q = 1; q <= 8; q++) {
      const vc = this.getBaseVC(q) + q * vcModifier;
      const tc = fc + Math.max(0, vc);
      const tr = q * marketPrice;
      const profit = tr - tc;
      if (profit > bestProfit) {
        bestProfit = profit;
        bestQ = q;
      }
    }
    return { optimalQ: bestQ, maxProfit: bestProfit };
  },

  /**
   * Run full clearing calculation for a round.
   * teamsData: array of { teamId, q, activeItems, hedgeQ }
   * mode: 1 (Price Taker) or 2 (Interactive Market)
   * fixedPrice: teacher-set price (Mode 1 only)
   */
  clearRound(teamsData, activeEvents, N, mode, fixedPrice) {
    mode = mode || 2;
    let totalSupply = 0;
    for (const team of teamsData) totalSupply += (team.q || 0);

    let marketPrice, marketDescription;
    if (mode === 1) {
      marketPrice = fixedPrice || 20;
      marketDescription = "教師設定價格 (Price Taker)";
    } else {
      const market = this.getMarketPrice(totalSupply, N, mode);
      marketPrice = market.price;
      marketDescription = market.description;
    }

    const teamResults = {};
    for (const team of teamsData) {
      teamResults[team.teamId] = this.calculateTeamResult(
        team.q || 0, activeEvents, team.activeItems || [], marketPrice,
        (mode === 2) ? (team.hedgeQ || 0) : 0
      );
    }

    return { totalSupply, marketPrice, marketDescription, teamResults };
  }
};
