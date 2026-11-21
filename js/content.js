/* =====================================================================
   CONTENT.JS  —  EVERYTHING THE PHONE SAYS LIVES HERE
   ---------------------------------------------------------------------
   You should never need to touch the other .js files to change lore.
   Edit text between the quotes, keep the commas, and save.

   Media files are looked up by NAME automatically:
     media/avatars/<contact id>.jpg      contact photo
     media/voicemail/<contact id>.mp3    what plays when you call them
   You can override either with  avatar:"path"  or  voicemail:"path".
   Until a voicemail file exists, the phone READS voicemailText aloud
   with the device's text-to-speech, so you can test before recording.

   ---------------------------------------------------------------------
   ACTIONS (used by dialCodes, easterEggs, and anywhere it says action)
     { type:"toast",  text:"..." }                  little gray popup
     { type:"dialog", title:"...", text:"..." }     popup box with OK
     { type:"sms",    thread:"id", text:"..." }     deliver a text message
     { type:"open",   app:"gallery" }               open an app
     { type:"call",   number:"210-555-0142" }       place a call
     { type:"sound",  file:"media/...mp3" }         play an audio file
     { type:"link",   url:"https://..." }           open a real web page
     { type:"flag",   name:"something" }            remember a secret
     { type:"tickets", amount:50 }                 give Drink Tickets (CSK TCG currency)
     { type:"pack" }                               give a free CSK TCG card pack
     { type:"card",   id:"comic-11" }              give a specific card (ids are in js/cards.js)
   Add  delay:5  to any action to wait 5 seconds first.
   Use a list [ {...}, {...} ] to do several things in a row.

   EVENTS (used by scheduled message "trigger")
     "unlocked"            phone unlocked
     "opened:<app id>"     app opened   (phone, messages, gallery,
                                         contacts, settings)
     "called:<contact id>" call to that contact finished
     "called:unknown"      called a number nobody owns
     "sms-sent:<thread>"   player texted that thread
     "dialcode:<code>"     a secret dial code was used
     "flag:<name>"         a flag action fired
     "game-start:podstack"         a Pod Stack game started
     "game-over:podstack"          a Pod Stack game ended
     "game-level:podstack"         reached a new level
     "game-start:flappynick"       a Flappy Nick game started
     "game-over:flappynick"        a Flappy Nick game ended
     "prompt-received"             the Writer sent a joke prompt
     "prompt-rated:like"           visitor liked a prompt
     "prompt-rated:dislike"        visitor passed on a prompt
     "prompts-reset"               show-day reset wiped the Writer's thread
     "flyer-saved"                 a flyer was saved to the Gallery
     "jar-finished"                someone drank the whole jar
     "opened:maps"                 the Maps app was opened
     "maps-directions"             someone tapped through to real directions
     "game-board:match3"           a match-3 board was cleared
     "game-over:nickrun"           a Nick Run run ended
     "level-clear:balloons"        Balloon Heist level cleared (data = level number)
     "game-over:balloons"          Balloon Heist ran out of knives
     "game-over:topple"            Mask Stack tower fell (data = { height })
     "clikcok-session"             closed ClikCok (data = milliseconds scrolled)
     "barkpod-feed"                BARKPOD loaded the podcast feed
     "prompt-sent"                 sent a prompt from PROMPT MACHINE
     "sled-play" / "sled-crash"    Line Ryder started a ride / the rider fell off
     "game-over:match3"            a match-3 run ended
   ===================================================================== */

window.PHONE_CONTENT = {

  /* ---------------- THE PHONE ITSELF ---------------- */
  phone: {
    ownerName:   "UNKNOWN",                 // shown in Settings > About
    carrier:     "ECLAIR WIRELESS",         // lock screen + notification shade
    lockMessage: "If found, please call 210-555-0199",   // under the lock clock ("" to hide)
    bootText:    "KILLDROID",               // shimmer text on boot (or drop media/boot/boot.png)
    model:       "Android Phone",
    bodyLabel:   "MK-I  //  ECLAIR",          // engraved on the desktop phone body ("" to hide)
    firmware:    "2.1-update1",
    baseband:    "32.36.00.28U_4.06.00.12_7",
    kernel:      "2.6.29-00479-g3c7df37\nandroid-build@apa26 #1",
    buildNumber: "ERE27",
    battery:     63,                        // percent shown in status bar
    use24h:      false,
    defaultRingSeconds: 4,                  // how long it rings before voicemail
    replyDelaySeconds:  4,                  // how long auto-replies take
    notInServiceText: "We're sorry. The number you have dialed is not in service. Please check the number and dial again.",
    // the voicemail button on the dialer (and dialing 1-2-3)
    voicemailBox: {
      number: "123",
      file:   "media/voicemail/voicemail-box.mp3",
      text:   "You have. Three. New messages. First new message. Received. Yesterday. At. Three thirty three A M."
    }
  },

  /* ---------------- THE SHOW ---------------- */
  show: {
    name:       "COLD START KILLERS",
    venue:      "COLD START DAB CO NORTH EAST",
    // Street address for the Maps app's "Get directions" (it opens the visitor's real map app).
    // Leave it blank and the map apps search for the venue name instead.
    address:    "12632 Nacogdoches Rd, San Antonio, TX 78217",
    tagline:    "Live stand-up comedy",
    ticketsUrl: "",          // paste a link here and tapping the countdown offers it
    // The home screen countdown. Always counts to the next show in the
    // show's own time zone, no matter where the visitor is.
    weekly: {
      weekday:   "Wednesday",
      time:      "20:00",            // 24-hour clock: 20:00 = 8:00 PM
      timeZone:  "America/Chicago",  // Central time (handles daylight saving)
      zoneLabel: "CT",
      liveHours: 3                   // widget says LIVE NOW for this long after start
    },
    liveText: "LIVE NOW"
  },

  /* ---------------- SOUND FILES ----------------
     Missing files are fine: the phone makes a synth version instead. */
  sounds: {
    notify:       "media/sounds/notification.mp3",
    unlock:       "media/sounds/unlock.mp3",
    ringback:     "media/sounds/ringback.mp3",
    hangup:       "media/sounds/hangup.mp3",
    notInService: "media/sounds/not-in-service.mp3",
    boot:         "media/boot/boot.mp3"
  },

  /* ---------------- HOME SCREEN ----------------
     icons: the STARTING layout of the home pages, left-to-right,
     top-to-bottom, 16 apps per page. Use null for an empty spot. Visitors can long-press
     icons to move them, so this only applies until they rearrange
     (or do a factory reset). */
  home: {
    // In order across the home pages: the first 16 are page 1, the next 16 page 2, and so on.
    // Apps left out of this list get added after these on their own. null = an empty spot.
    icons: ["promptmachine", "barkpod", "gallery", "clikcok", "characters", "maps", "flyer", "contacts",
            "settings", "jar",
            "csktcg", "nickrun", "podstack", "flappynick", "match3", "sled", "balloons", "topple"],
    dock:  ["phone", "messages"],                             // left and right of the drawer tab
    // extra pictures for the Wallpapers picker (long-press the home screen).
    // Anything named wallpaper-1.jpg, background-1.jpg ... in media/wallpaper
    // and gallery photos with "wallpaper"/"background" in the name are found automatically.
    wallpapers: [],

    // LIVE WALLPAPERS: short looping videos behind the home + lock screens.
    // Just drop media/live/live-wallpaper-1.mp4 ... live-wallpaper-5.mp4 in; they're found automatically.
    // Optional: give them names here (otherwise they show as "Live wallpaper 1", "Live wallpaper 2"...):
    //   { id: "live-wallpaper-1", name: "Neon Alley", description: "Rain that never stops", speed: 0.5 },
    // speed: 0.5 = half speed, 1 = normal. Leave it out to use liveSpeed below.
    // Image sequences (a folder of numbered frames) still work too. See media/live/README.md.
    liveSpeed: 0.5,               // playback speed for all live wallpaper videos (0.5 = half speed)
    liveWallpapers: [
    ]
  },

  /* ---------------- CONTACTS ----------------
     id: short, lowercase, no spaces. Used for file names + threads. */
  contacts: [
    { id: "mom", name: "Mom", number: "210-555-0142",
      voicemailText: "Hi honey, it's Mom. I saw your show flyer on the fridge at your aunt's house. You put my phone number on it? People keep calling me. Call me back." },
    { id: "booker", name: "Dabbin Dan", number: "210-555-0199",
      voicemailText: "Yeah it's me. The venue says you're on at nine, not eight. Or eight, not nine. Just be there at both. Bye." },
    { id: "donotanswer", name: "DO NOT ANSWER", number: "000-000-0000", ringSeconds: 9,
      voicemailText: "You called back. Nobody calls back. Check your pictures." },
    { id: "writer", name: "Ray", number: "210-555-0168",
      voicemailText: "It's Ray. I'm writing. Rate the prompts, I can see when you don't." },
    { id: "landlord", name: "Comedian Nick Martin", number: "210-555-0117",
      voicemailText: "This is about the noise. The laughing. At three in the morning. Please stop rehearsing in the bathtub." }
  ],

  /* ---------------- CALL LOG ----------------
     type: "missed" | "incoming" | "outgoing"
     use contact:"id" OR number:"..." (+ optional name) */
  callLog: [
    { contact: "donotanswer", type: "missed",   time: "3:33 AM" },
    { contact: "donotanswer", type: "missed",   time: "3:32 AM" },
    { contact: "mom",         type: "missed",   time: "Yesterday" },
    { number: "210-555-0000", type: "incoming", time: "Mar 14" },
    { contact: "booker",      type: "outgoing", time: "Mar 12" },
    { contact: "landlord",    type: "incoming", time: "Mar 10" }
  ],

  /* ---------------- TEXT MESSAGE THREADS ----------------
     id: thread id (use the contact id to keep it simple)
     messages: me:true = sent by phone owner
     unread: how many show as unread on first visit
     autoReplies: cycled through when the player texts this thread
     failSend: true = every message the player sends "fails" */
  threads: [
    { id: "booker", contact: "booker", unread: 1,
      messages: [
        { text: "you still doing the set saturday", time: "Mar 12" },
        { me: true, text: "yes", time: "Mar 12" },
        { text: "cool bring the phone", time: "Mar 12" },
        { text: "THE phone", time: "Mar 13" }
      ],
      autoReplies: ["ok", "dont text me during the show", "seriously"] },
    { id: "mom", contact: "mom",
      messages: [
        { text: "Are you eating", time: "Mar 11" },
        { me: true, text: "yes mom", time: "Mar 11" },
        { text: "What", time: "Mar 11" }
      ],
      autoReplies: ["Call me", "Who is this", "I'm telling your father"] },
    // the Writer's joke prompts arrive here automatically (see "prompts" below)
    { id: "writer", contact: "writer", messages: [],
      autoReplies: ["just rate the bits", "noted", "lol ok", "im putting that in the notes app"] },
    { id: "donotanswer", contact: "donotanswer", unread: 2, failSend: true,
      messages: [
        { text: "i found your phone", time: "3:30 AM" },
        { text: "i found your phone", time: "3:31 AM" }
      ] }
  ],

  /* ---------------- THE WRITER'S JOKE PROMPTS ----------------
     Every few minutes the Writer texts one random line from your text
     files (media/prompts/), wrapped in a random framing. {prompt} marks
     where the line goes. Texts pile up until read, can be liked or passed
     on, and the thread wipes clean at the start of every show day. */
  prompts: {
    enabled:  true,
    thread:   "writer",                     // contact id that sends them
    name:     "Ray",
    folder:   "media/prompts/",
    files:    ["text-1.txt", "text-2.txt", "text-3.txt"],
    framings: [
      "what about... {prompt}",
      "ok hear me out: {prompt}",
      "new bit. {prompt}",
      "is this anything? {prompt}",
      "{prompt}\n\ntoo much?",
      "thinking about opening with this: {prompt}",
      "u up? {prompt}",
      "write this down. {prompt}",
      "{prompt} ...right??",
      "dont laugh. {prompt}"
    ],
    firstDelaySeconds: 25,                  // first text after unlocking (first visit)
    minMinutes: 1,                          // gap between texts: random between these
    maxMinutes: 4,
    maxCatchUp: 3,                          // most texts that "arrived while you were away"
    replyDelaySeconds: 3,
    likeReplies:    [":)", ":D", "=)", "B)", ":-)"],
    dislikeReplies: [":(", ":'(", "=(", ":-(", "D:"],
    resetOnShowDay: true,                   // wipe the thread at midnight (show time zone) on show day
    showDayMessage: "its show day. clean slate. see you at 8"   // first text after the reset ("" for none)
  },

  /* ---------------- MESSAGES THAT ARRIVE WHILE PLAYING ----------------
     id: unique, never reuse (it's how the phone remembers it already sent it)
     delay: seconds after unlock (or after the trigger fires)
     trigger: optional event name, see EVENTS at the top
     thread: which thread. A new id + from:"name" creates a new thread. */
  scheduledMessages: [
    { id: "s1", thread: "booker", delay: 40,  text: "where are you" },
    { id: "s2", thread: "donotanswer", delay: 120, text: "you have nice pictures" },
    { id: "s3", thread: "mom", trigger: "called:mom", delay: 6, text: "Why did you hang up on my voicemail" },
    { id: "s4", thread: "stranger", from: "Unknown", number: "(000) 000-0000",
      trigger: "opened:gallery", delay: 10, text: "go back to the photos" }
  ],

  /* ---------------- SECRET DIAL CODES ----------------
     Codes with * or # in them fire the instant they're typed (like real
     Android secret codes). Plain-number codes fire when you press call. */
  dialCodes: {
    "*#*#4636#*#*": { type: "dialog", title: "Testing", text: "Phone information\nSignal: haunted\nBattery: lying" },
    "*#*#1337#*#*": [
      { type: "toast", text: "Developer access granted" },
      { type: "sms", thread: "donotanswer", text: "who told you that code", delay: 4 }
    ],
    "8675309": { type: "toast", text: "Jenny changed her number." },
    "*#*#9748#*#*": { type: "event", name: "prompts:send" }      // W-R-I-T: the Writer texts a prompt right now (testing)
  },

  /* ---------------- OTHER EASTER EGGS ---------------- */
  easterEggs: {
    buildNumber: { taps: 7, action: { type: "dialog", title: "Eclair", text: "You are now a developer.\n\nThe show is a developer too." } }
  },

  /* ---------------- CHARACTERS (3D) ----------------
     The Killmiibos app (internal id "characters"): a shelf of spinning 3D models from the show.
     1. Put the .glb file in media/characters/
     2. Add a line here: name, file, and an optional short bio.
     Order here = order on the shelf. */
  characters: {
    name: "Killmiibos",
    list: [
      { name: "Mega Nick", model: "mega-nick-1.glb", bio: "" },
      { name: "Rodichu", model: "rodichu-1.glb", bio: "" },
      { name: "Super Rocco", model: "super-rocco-1.glb", bio: "" }
      // { name: "Nick", model: "nick.glb", bio: "Fell into a jar once." },
    ]
  },

  /* ---------------- PROMPT MACHINE ----------------
     Send prompts to the show's queue from the phone, any day of the week.
     Uses the same Firebase database as the prompt-machine web page, so the
     receiver at the show reads these out with everything else. */
  promptMachine: {
    name:      "PROMPT MACHINE",
    database:  "https://prompt-bot-csk-default-rtdb.firebaseio.com",
    path:      "prompts",
    maxChars:  200,
    cooldown:  10,               // seconds between sends on one phone
    readBonus: 50                // CSK TCG Drink Tickets when one of your prompts gets read on stage
  },

  /* ---------------- BARKPOD ----------------
     The podcast player. Reads the RSS feed live, so new episodes show up on their own.
     Listeners can stream, or tap download to keep an episode for offline. */
  barkpod: {
    name:         "BARKPOD",
    feed:         "https://feed.podbean.com/MICDOGSSA/feed.xml",
    checkMinutes: 30,           // how often to look for new episodes while someone has the phone open
    skipBack:     15,           // seconds
    skipForward:  30
  },

  /* ---------------- CLIKCOK ----------------
     Endless 5-second videos, played in random order. No likes; just a tiny timer.
     Videos go in media/clikcok/ named clok0000.mp4, clok0001.mp4 ... (see the README there). */
  clikcok: {
    name:   "ClikCok",
    count:  100,                // looks for clok0000 ... clok0100 (keeps going if there are more)
    handle: "@clikcok",         // shown on every video
    tags:   ["#fyp", "#foryou", "#clok", "#doomscroll", "#5seconds", "#coldstartkillers", "#nolikes", "#keepscrolling"],
    rewards: [
      // { minutes: 60, action: { type: "sms", thread: "booker", text: "an hour?? on clikcok??", delay: 3 } }   total minutes ever
    ]
  },

  /* ---------------- FLYER MAKER ----------------
     Art goes in media/flyer/ (see the README there). */
  flyer: {
    name:   "Flyer Maker",
    width:  720,                // finished flyer size in pixels (9:16 portrait, matches
    height: 1280,               //   the BK backgrounds). Other background sizes get cropped to fill.
    comics: [],                 // quick-add buttons on the Text tab, e.g. ["Nick Martin", "Rod"]
    maxSaved: 6                 // how many saved flyers the Gallery keeps
  },

  /* ---------------- GAMES ----------------
     Sprites + sounds go in media/games/<game id>/ (see the README there).
     Every number here is optional; leave one out to use the default. */
  games: {
    podstack: {
      name: "Pod Stack",          // name under the icon + on the title screen
      lives: 3,
      startSpeed: 150,            // how fast things fall at level 1
      speedUp: 1.12,              // ...multiplied by this each level
      spawnEvery: 1.0,            // seconds between drops at level 1
      trashChance: 0.2,           // 0.2 = 1 in 5 drops is trash at level 1
      trashChanceStep: 0.04,      // more trash each level
      goldChance: 0.03,           // rare gold pod = +1 life
      podsPerLevel: 12,
      knockOff: 3,                // pods lost when you catch trash
      podSpacing: 31,             // distance between stacked pods. Stack looks gappy? lower it. Squished? raise it.
      holderSink: 18,             // how far the bottom pod sits down into the holder. Floating above it? raise it.
      missCostsLife: false,       // true = dropping a pod also costs a life
      // One pod picture (pod.png) for everything. For multiple colors,
      // list them, e.g. ["blue","orange"], and add pod-blue.png, pod-orange.png.
      colors: ["default"],

      // One-time unlocks per visitor when they hit a score. Any ACTION works.
      rewards: [
        { id: "r500",  score: 500,  action: { type: "sms", thread: "booker", text: "who taught you to stack like that", delay: 2 } },
        { id: "r2000", score: 2000, action: { type: "sms", thread: "donotanswer", text: "the tower is tall enough now", delay: 4 } }
      ]
    },

    flappynick: {
      name: "Flappy Nick",
      gravity: 1400,          // pull down. Higher = Nick drops faster
      flap: 400,              // how high each tap kicks him
      speed: 125,             // cloud scroll speed at the start
      maxSpeed: 200,          // it speeds up a little each point, up to this
      gap: 135,               // opening between storm clouds at the start
      minGap: 105,            // it narrows each point, down to this
      spacing: 185,           // distance between cloud columns
      hitbox: 0.7,            // share of Nick's sprite that counts as a hit. Lower = more forgiving
      medals: [10, 20, 30, 50],   // bronze, silver, gold, platinum

      rewards: [
        { id: "f10", score: 10, action: { type: "sms", thread: "booker", text: "nick says stop making him fly", delay: 2 } }
      ]
    },

    match3: {
      name: "Match Killer",       // placeholder name, call it whatever you want
      types: 6,                   // how many tile sprites you made: tile-1.png ... tile-6.png
      moves: 20,                  // moves per board
      target: 800,                // score needed to clear board 1
      targetStep: 300,            // each board after that needs this much more
      moveBonus: 60,              // points per unused move when you clear a board
      hintDelay: 6,               // seconds before a hint wiggles
      praise: ["NICE", "KILLER", "COLD BLOODED", "STANDING OVATION"],   // chain reactions 2x, 3x, 4x, 5x+

      // one-time unlocks when a visitor clears this many boards
      rewards: [
        { id: "m3", board: 3, action: { type: "sms", thread: "mom", text: "Your cousin says you're good at the candy game now. Call me", delay: 2 } }
      ]
    },

    // tilt-to-drink mason jar (all drawn in code). Tilt needs HTTPS (GitHub Pages);
    // anywhere else it falls back to dragging sideways to tip the jar.
    jar: {
      name: "Nick's Pee",
      label: "nicks pee",             // written on the jar's label
      liquidTop: "#d4a10f",           // dark yellow
      liquidBottom: "#8a5f00",
      foam: "#fff2b3",
      drinkSpeed: 0.55,               // how fast it pours out when tipped
      emptyMessage: "Nick needs a minute.",
      rewards: [
        { id: "j3", count: 3, action: { type: "sms", thread: "booker", text: "why are people at the venue asking for a jar", delay: 3 } }
      ]
    },

    // one-button rooftop runner. Sprites: media/games/nickrun/nick-run.png + nick-jump.png
    // Topple-style tower of blocks in ski masks. Physics: js/lib/matter.min.js
    topple: {
      name: "Mask Stack",
      lives: 3,                   // blocks you can drop off the stage before it's over
      stageWidth: 150,            // stage width (screen is 320 wide). Smaller = harder
      tilt: 0.45,                 // how hard tilting the phone pushes the tower
      bounce: 0.1,                // 0 = blocks land dead, 1 = rubber (they always squash on landing)
      rewards: [
        // { height: 20, action: { type: "sms", thread: "booker", text: "...", delay: 3 } }   height in blocks
      ]
    },
    // monkey in a ski mask throws knives. Sprites: media/games/balloons/balloon-1.png ... balloon-5.png
    balloons: {
      name: "Balloon Heist",
      gravity: 520,               // how fast knives drop
      maxThrow: 660,              // fastest throw (full pull back)
      startDarts: 6,              // knives on level 1 (one fewer every 5 levels, never under 4)
      rewards: [
        // { level: 10, action: { type: "sms", thread: "booker", text: "...", delay: 3 } }
      ]
    },
    nickrun: {
      name: "Nick Run",
      startSpeed: 150,            // how fast he starts
      maxSpeed: 380,              // top speed
      accel: 7,                   // how quickly he speeds up
      jarSlow: 0.72,              // hitting a jar multiplies speed by this
      jarChance: 0.55,            // how many rooftops have jars
      rewards: [
        { id: "r1000", meters: 1000, action: { type: "sms", thread: "booker", text: "nick says he ran here. he took the bus", delay: 3 } }
      ]
    },

    // draw-a-track sled toy. Sprite: media/games/sled/head.png
    sled: {
      name: "Line Ryder",
      gravity: 0.175,             // per physics tick (40 a second)
      endurance: 0.3,             // how easily he falls off (lower = crashes easier)
      boost: 0.1,                 // red line speed push
      headSize: 9                 // head size (the torso is 5.5)
    }
  }
};
