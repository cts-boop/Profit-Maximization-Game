# 🧋 決戰邊際：奶茶大亨 (Marginal Tycoon)

A real-time multiplayer economics game for HKDSE students to learn **Profit Maximization (MR=MC)**, **Law of Diminishing Marginal Returns**, and short-run production decisions.

---

## 📁 File Structure

```
Profit Maximization Game/
├── index.html          ← Landing page (role selector)
├── teacher.html        ← Teacher dashboard
├── student.html        ← Student decision panel
├── display.html        ← Projector / public screen
├── css/
│   └── style.css       ← All styles
└── js/
    ├── firebase-config.js   ← Firebase init (edit this first!)
    └── game-engine.js       ← Core economic engine
```

---

## 🔥 Step 1 — Firebase Setup

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click **Add project** → give it a name (e.g. `marginal-tycoon`) → Create
3. In the left sidebar: **Build → Firestore Database → Create database**
   - Choose **Start in test mode** (for classroom use)
   - Pick any region → Enable
4. In the left sidebar: **Project Settings** (⚙️ gear icon) → **General**
5. Scroll to **Your apps** → click `</>` (Web app)
6. Register app (any nickname) → copy the `firebaseConfig` object
7. Open `js/firebase-config.js` and **replace** the placeholder config:

```js
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

---

## 🔒 Step 2 — Firestore Security Rules (Recommended)

In Firebase Console → **Firestore → Rules**, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads and writes during classroom session
    match /game_sessions/{sessionId} {
      allow read, write: if true;
      match /{subcollection}/{docId} {
        allow read, write: if true;
      }
    }
  }
}
```

> ⚠️ This is open access suitable for a controlled classroom. Do **not** use in production.

---

## 🌐 Step 3 — Host the Game

### Option A — Local (simplest for classroom on same WiFi)

Install a simple local server:
```bash
# Python 3
cd "Profit Maximization Game"
python3 -m http.server 8080
```
Then open `http://localhost:8080` on the teacher's machine.  
Students connect via the teacher's local IP: `http://192.168.x.x:8080`

### Option B — Firebase Hosting (recommended for internet access)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # set public dir to "." (current folder)
firebase deploy
```
Firebase gives you a public URL to share with students.

### Option C — Any static host
Upload the entire folder to **Netlify Drop**, **Vercel**, or **GitHub Pages** — no server required.

---

## 🎮 How to Run a Class Session

### Teacher
1. Open `teacher.html` → click **建立課堂**
2. A 4-digit code appears — write it on the board
3. Wait for teams to join (connection status shows live)
4. Click **全部就緒，開始遊戲**

### Students (5 teams, 1 device per team)
1. Open `student.html` on any device on the same network
2. Enter the 4-digit code + select their team → **加入遊戲**

### Projector
1. Open `display.html` on the projector/TV browser
2. Enter the same 4-digit code → **連接**

### Each Round Flow
| Step | Who | Action |
|------|-----|--------|
| 1 | Teacher | Click **開始本回合** |
| 2 | Students | Use paper + calculator to build MC table, set labor slider, buy items |
| 3 | Teacher | Optionally trigger **Event Cards** (E03–E08) |
| 4 | Students | Click **確認提交** (form locks) |
| 5 | Teacher | Click **強制結束決策** (or wait for timer) |
| 6 | Teacher | Click **公佈結算結果** |
| 7 | All | View results — projector shows slot-machine reveal + leaderboard |
| 8 | Teacher | Debrief using the **覆盤分析矩陣** (red rows = over-production) |
| 9 | Teacher | Click **下一回合** |

---

## 📐 Economic Rules Reference

### Production Table (fixed — do not change)
| Labor | TP | MP | FC | VC | TC | MC |
|-------|----|----|-----|-----|-----|-----|
| 0 | 0 | — | $200 | $0 | $200 | — |
| 1 | 10 | 10 | $200 | $100 | $300 | $10 |
| 2 | 30 | 20 | $200 | $200 | $400 | $5 |
| 3 | 40 | 10 | $200 | $300 | $500 | $10 |
| 4 | 45 | 5 | $200 | $400 | $600 | $20 |
| 5 | 47 | 2 | $200 | $500 | $700 | $50 |
| 6 | 48 | 1 | $200 | $600 | $800 | $100 |

### Market Demand (Normal)
| Total Supply | Price | Status |
|-------------|-------|--------|
| 0 – 179 | $50 | Shortage |
| 180 – 210 | $20 | Equilibrium |
| 211 – 230 | $10 | Surplus |
| 231+ | $5 | Market Crash |

### Optimal Decision (MR = MC rule)
At price **$20** (equilibrium): hire **3 workers** (MC=$10 < $20, MC of 4th=$20 = price → stop)  
At price **$50** (shortage): hire **4 workers** (MC=$20 < $50, MC of 5th=$50 = price → stop)

---

## 🛒 Items & Events

### Item Shop (per team, this round only)
| Item | Cost | Effect |
|------|------|--------|
| 🔍 精準市場調查 | $50 | Reveals demand tier table |
| 🤖 自動化打茶機 | $150 | Wage per worker −$50 this round |
| ⭐ 品牌忠誠度 | $200 | +$10 price premium at settlement |

### Event Cards (teacher-triggered, all teams)
| Event | Effect |
|-------|--------|
| 🏠📈 業主大幅加租 | FC +$100 |
| 🏠📉 租金津貼 | FC −$100 |
| 💰📈 最低工資上調 | Wage/worker +$50 |
| 🍵📉 低成本茶葉 | Wage/worker −$20 |
| 💀🏠 天價續租 (trap) | FC +$400 |
| 💀🍵 茶葉失收 (trap) | Wage/worker +$300 |

---

## 🔑 Key Pedagogical Notes

- **MC is never shown** to students during the decision phase — they must calculate it manually on paper
- **Red rows** in the debriefing matrix flag teams where the last worker's MC exceeded the market price (over-production)
- **💀 Shutdown warning** appears in the student report if TR < TVC (below shutdown point)
- Starting capital is **$50,000** per team — intentionally large so early mistakes don't eliminate teams
