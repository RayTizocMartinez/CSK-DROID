/* =====================================================================
   CARDS.JS — EVERYTHING ABOUT THE CSK TCG LIVES HERE
   ---------------------------------------------------------------------
   Edit names, costs, stats, text and odds here. Keep the quotes and commas.
   Card art:        media/cards/<card id>.png   (512 x 512, square)
   Rival portraits: media/cards/rivals/<portrait>.png
   Missing art draws a styled placeholder, so the game works before art exists.

   CARD FIELDS
     id       file name of the art, never change it after people own the card
     name     shown on the card
     type     "comic" (stays on the board) or "bit" (one-shot)
     rarity   "openmic" | "feature" | "headliner" | "legend"
     cost     Stage Time to play
     punch    attack            (comics only)
     nerve    health            (comics only)
     ability  title of the ability (shown in bold)
     text     what it does, in plain words (shown on the card)
     battle   true = can't come from packs, only from taking over a venue
     fx       the rules the game actually runs (see the list at the bottom)
   ===================================================================== */
window.TCG = {

  name:       "CSK TCG",
  currency:   "Drink Tickets",
  booker:     "You",
  homeBase:   "Cold Start Dab Co",
  startCrowd: 20,               // both sides' health
  boardSize:  5,                // comics each side can have out
  handLimit:  7,
  deckSize:   20,
  startHand:  3,                // cards you start with (the side going second gets +1)

  /* ---------------- THE CARDS ---------------- */
  cards: [
    // -------- OPEN MIC --------
    { id: "comic-01", name: "Super Rocco", type: "comic", rarity: "openmic", cost: 3, punch: 1, nerve: 1,
      ability: "Wack", text: "Opener: take out an enemy comic that costs 5 or more.",
      fx: { opener: "destroyBig", minCost: 5 } },
    { id: "comic-02", name: "Mega Nick", type: "comic", rarity: "openmic", cost: 2, punch: 1, nerve: 4,
      ability: "Cannon Fodder", text: "Bouncer. The first time he'd go down, he stays up with 1 Nerve.",
      fx: { bouncer: true, cling: true } },
    { id: "comic-03", name: "Joshu", type: "comic", rarity: "openmic", cost: 2, punch: 2, nerve: 1,
      ability: "Super Host", text: "Opener: your next comic that costs 5 or more costs 2 less.",
      fx: { opener: "discountBig", minCost: 5, amount: 2 } },
    { id: "comic-04", name: "Captain Corbin", type: "comic", rarity: "openmic", cost: 4, punch: 2, nerve: 4,
      ability: "Pirate Slam", text: "Opener: deal 2 damage to an enemy comic.",
      fx: { opener: "damageEnemyComic", amount: 2 } },
    { id: "comic-05", name: "Bill Bill", type: "comic", rarity: "openmic", cost: 6, punch: 4, nerve: 7,
      ability: "San Antonio Jesus", text: "Bouncer.",
      fx: { bouncer: true } },
    { id: "comic-06", name: "DPOT", type: "comic", rarity: "openmic", cost: 4, punch: 5, nerve: 3,
      ability: "", text: "Hits hard. No tricks.",
      fx: {} },
    { id: "comic-07", name: "Javi City", type: "comic", rarity: "openmic", cost: 1, punch: 4, nerve: 2,
      ability: "Jack of All Mics", text: "You get 1 less Stage Time next turn.",
      fx: { overload: 1 } },

    // -------- FEATURE --------
    { id: "comic-08", name: "Lil Nick", type: "comic", rarity: "feature", cost: 2, punch: 1, nerve: 2,
      ability: "Just Fucking With It", text: "Gets +2 Punch and +1 Nerve every time another one of your comics goes down.",
      fx: { onAllyDeath: { punch: 2, nerve: 1 } } },
    { id: "comic-09", name: "Alonzo Can Too", type: "comic", rarity: "feature", cost: 3, punch: 1, nerve: 1,
      ability: "Mimic", text: "Opener: copy the Punch and Nerve of any other comic on the board.",
      fx: { opener: "copyStats" } },
    { id: "comic-10", name: "Mighty Micah", type: "comic", rarity: "feature", cost: 5, punch: 3, nerve: 4,
      ability: "Positive Vibes", text: "Opener: your other comics get +1 Nerve.",
      fx: { opener: "buffAllies", nerve: 1 } },

    // -------- HEADLINER --------
    { id: "comic-11", name: "Bob Del", type: "comic", rarity: "headliner", cost: 9, punch: 8, nerve: 8,
      ability: "Being Bob Del", text: "Cold Open.",
      fx: { cold: true } },

    // -------- BITS --------
    { id: "bit-light", name: "Get the Light", type: "bit", rarity: "openmic", cost: 4,
      ability: "", text: "Knock out any enemy comic.",
      fx: { play: "destroyEnemyComic" } },
    { id: "bit-heckler", name: "Heckler", type: "bit", rarity: "openmic", cost: 1,
      ability: "", text: "Deal 2 damage to any comic or the enemy venue.",
      fx: { play: "damageAny", amount: 2 } },
    { id: "bit-two-drink", name: "Two-Drink Minimum", type: "bit", rarity: "feature", cost: 1,
      ability: "", text: "Your opponent gets 2 less Stage Time next turn.",
      fx: { play: "overloadEnemy", amount: 2 } },
    { id: "bit-crowd-work", name: "Crowd Work", type: "bit", rarity: "headliner", cost: 3,
      ability: "", text: "Deal 1 damage to every enemy comic, then draw a card.",
      fx: { play: "aoeDraw", amount: 1, draw: 1 } },

    // -------- BATTLE-ONLY (won by taking over a venue) --------
    { id: "venue-1-card", name: "Bloody Mia", type: "comic", rarity: "feature", cost: 2, punch: 4, nerve: 1, battle: true,
      ability: "Scary", text: "Cold Open.",
      fx: { cold: true } },
    { id: "venue-2-card", name: "Electric Avery", type: "comic", rarity: "feature", cost: 4, punch: 5, nerve: 3, battle: true,
      ability: "Charged Up", text: "Thick Skin.",
      fx: { thick: true } },
    { id: "venue-3-card", name: "Hey Bolstag", type: "comic", rarity: "feature", cost: 8, punch: 3, nerve: 3, battle: true,
      ability: "Hey Buddy", text: "Opener: slip them a 20. Take one of their comics for yourself.",
      fx: { opener: "steal" } },
    { id: "venue-4-card", name: "Sniper Her Jackson", type: "comic", rarity: "headliner", cost: 5, punch: 5, nerve: 2, battle: true,
      ability: "Overwatch", text: "The next comic your opponent plays gets taken out the moment it lands.",
      fx: { opener: "snipeNext" } },
    { id: "venue-5-card", name: "Todd Glass", type: "comic", rarity: "legend", cost: 7, punch: 4, nerve: 6, battle: true,
      ability: "Credibility Bump", text: "While he's out, your other comics have +2 Punch.",
      fx: { auraPunch: 2 } }
  ],

  /* ---------------- YOUR STARTER DECK (20 cards) ---------------- */
  starterDeck: [
    "comic-01", "comic-01", "comic-02", "comic-02", "comic-03", "comic-03", "comic-04", "comic-04",
    "comic-05", "comic-05", "comic-06", "comic-06", "comic-07", "comic-07",
    "bit-light", "bit-light", "bit-heckler", "bit-heckler",
    "comic-08", "comic-10"
  ],

  /* ---------------- THE VENUES (easiest first) ----------------
     reward:     battle-only card for the first takeover
     crowd:      the venue's health (default startCrowd). Bigger = harder
     bonusMana:  extra Stage Time the rival starts with (optional, makes it MUCH harder)
     style:      "aggro" = the rival rushes your Crowd instead of trading
     deck:       the rival's 20 cards
     lines:      things the rival says (start, win, lose)            */
  homeLat: 29.5649, homeLng: -98.4097,
  venues: [
    { id: "v1", name: "Upsell Comedy Lounge", vibe: "Barebones comedy club", rival: "b.Really", portrait: "rival-1",
      rivalVibe: "Basic", reward: "venue-1-card", tickets: 100, x: 22, y: 70,
      lines: { start: "Welcome to the Lounge. Two-item minimum.", win: "That's... fine. Basic.", lose: "Ugh. Fine. Take it." },
      crowd: 14,
      deck: ["comic-07", "comic-07", "comic-07", "comic-02", "comic-02", "comic-02", "comic-03", "comic-03", "comic-03", "comic-06",
             "comic-06", "comic-06", "comic-04", "comic-04", "comic-04", "comic-01", "comic-01", "comic-01", "comic-05", "comic-05"] },
    { id: "v2", name: "Deaf Kitty", vibe: "Too cool for school", rival: "Rice-Man", portrait: "rival-2",
      rivalVibe: "Basement black box", reward: "venue-2-card", tickets: 125, x: 70, y: 62, style: "aggro",
      lines: { start: "You probably haven't heard of this room.", win: "Called it. You were mainstream.", lose: "Whatever. It was ironic." },
      deck: ["comic-07", "comic-07", "venue-1-card", "venue-1-card", "comic-03", "comic-03", "comic-06", "comic-06", "comic-08", "comic-08",
             "bit-heckler", "bit-heckler", "bit-two-drink", "comic-02", "comic-02", "comic-04", "comic-01", "comic-06", "comic-07", "bit-heckler"] },
    { id: "v3", name: "Wood Hard Speak Easy", vibe: "Old timers", rival: "Bobby Ocean", portrait: "rival-3",
      rivalVibe: "Art deco", reward: "venue-3-card", tickets: 150, x: 40, y: 40, crowd: 25,
      lines: { start: "Password's 'set list,' kid. Sit down.", win: "Back in my day we bombed with dignity.", lose: "The room's yours. Mind the velvet." },
      deck: ["comic-02", "comic-02", "comic-05", "comic-05", "comic-10", "comic-10", "comic-04", "comic-04", "comic-02", "comic-05",
             "comic-03", "comic-03", "comic-09", "comic-09", "bit-light", "bit-crowd-work", "comic-01", "comic-06", "comic-06", "comic-11"] },
    { id: "v4", name: "The Public Disturbance", vibe: "Downtown comedy club", rival: "The Sheriff", portrait: "rival-4",
      rivalVibe: "True grit", reward: "venue-4-card", tickets: 200, x: 76, y: 30, crowd: 28,
      lines: { start: "This town ain't big enough for two bookers.", win: "Get outta my town.", lose: "Take the badge. You earned it." },
      deck: ["bit-light", "bit-light", "bit-heckler", "bit-heckler", "venue-4-card", "comic-01", "comic-01", "comic-04", "comic-04", "comic-06",
             "comic-06", "venue-2-card", "venue-2-card", "comic-05", "comic-05", "comic-10", "bit-crowd-work", "comic-02", "comic-07", "comic-11"] },
    { id: "v5", name: "LMAO", vibe: "Corporate", rival: "Some Guy in a Tie", portrait: "rival-5",
      rivalVibe: "Big money", reward: "venue-5-card", tickets: 300, x: 50, y: 14, crowd: 32,
      lines: { start: "Let's circle back after I buy your whole lineup.", win: "Per my last email: you lost.", lose: "I'll have legal call your... people." },
      deck: ["comic-11", "comic-11", "venue-3-card", "comic-05", "comic-05", "comic-10", "comic-10", "venue-4-card", "venue-2-card", "venue-2-card",
             "comic-04", "comic-04", "comic-02", "comic-02", "comic-03", "comic-03", "bit-light", "bit-light", "bit-crowd-work", "comic-06"] }
  ],

  /* ---------------- BATTLE PAYOUTS ---------------- */
  battle: {
    rematchTickets: 40,     // win at a venue you already own
    lossTickets:    5,      // showing up counts for something
    rematchCardChance: 0.15 // chance a rematch win drops a battle-only card you don't have yet (from venues you own)
  },
  venueIncome: 10,          // Drink Tickets per day for every venue you own (collected when you open the game, up to 3 days)

  /* ---------------- PACKS ---------------- */
  pack: {
    price: 100,
    size:  5,
    odds:  { openmic: 72, feature: 22, headliner: 5, legend: 1 },   // per card, out of 100
    guaranteeFeature: true                                          // every pack has at least one Feature or better
  },
  maxCopies:  { openmic: 2, feature: 2, headliner: 2, legend: 1 },  // extra copies sell back automatically
  sellValue:  { openmic: 5, feature: 20, headliner: 50, legend: 200 },

  /* ---------------- DRINK TICKETS FROM THE MINI GAMES ----------------
     Paid when a game ends. per = tickets per that many points.
     First play of each game each day pays firstPlayBonus extra.
     After dailySoftCap tickets from one game in a day, that game pays half.
     Everything pays double on show day.                                   */
  firstPlayBonus: 25,
  dailySoftCap:   150,
  showDayDouble:  true,
  payouts: {
    podstack:   { event: "game-over:podstack",  field: "score",  per: 5,  label: "Pod Stack" },
    flappynick: { event: "game-over:flappynick", field: "score", per: 1,  label: "Flappy Nick" },
    match3:     { event: "game-over:match3",    field: "boards", per: 0.1, label: "Match Killer" },   // 10 per board cleared
    nickrun:    { event: "game-over:nickrun",   field: "meters", per: 50, label: "Nick Run" },
    balloons:   { event: "level-clear:balloons", field: null,    flat: 10, label: "Balloon Heist" },
    topple:     { event: "game-over:topple",    field: "height", per: 0.5, label: "Mask Stack" },     // 2 per block tall
    sled:       { event: "sled-crash",          field: null,     ticksPer: 200, max: 20, label: "Line Ryder" },  // 1 per 5 seconds ridden
    jar:        { event: "jar-finished",        field: null,     flat: 5,  label: "Nick's Pee" },
    clikcok:    { event: "clikcok-session",     field: null,     msPer: 60000, label: "ClikCok" },     // 1 per minute scrolled
    barkpod:    { event: "barkpod-listened",    field: null,     flat: 1,  label: "BARKPOD" },         // 1 per 2 minutes listened (5 per 10)
    promptmachine: { event: "prompt-sent",      field: null,     flat: 0,  label: "PROMPT MACHINE" }   // only the first-prompt-of-the-day bonus, so nobody spams the show's queue for tickets
  }

  /* ---------------- fx: the rules the game runs ----------------
     bouncer: true            must be attacked first
     cold: true               Cold Open, can attack right away
     thick: true              Thick Skin, ignores the first hit
     cling: true              the first time it would go down, stays at 1 Nerve
     overload: N              you get N less Stage Time next turn
     onAllyDeath: {punch, nerve}   grows when another of your comics goes down
     auraPunch: N             your other comics have +N Punch while it's out
     opener: "destroyBig" (minCost) | "discountBig" (minCost, amount) | "damageEnemyComic" (amount)
             "copyStats" | "buffAllies" (punch, nerve) | "steal" | "snipeNext"
     play (bits): "destroyEnemyComic" | "damageAny" (amount) | "overloadEnemy" (amount) | "aoeDraw" (amount, draw)
  */
};
