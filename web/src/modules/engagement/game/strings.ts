// ─── modules/engagement/game/strings.ts ──────────────────────────────────────
// ONE language. Every Find-the-Location UI string lives here, in English.
// No mixed-language fallbacks, no untranslated keys leaking through.
// Components must import copy from this file, never hardcode game strings
// inline. Mirrors the pattern in modules/discovery/strings.ts.

export const gameStrings = {
  // ── Start screen ──
  gameName: "Find the Location",
  gameTagline: "Pinpoint Leonida.",
  gameEyebrow: "GTA6mapx · Mini-game",
  howToPlay:
    "Read the clue dossier, drop a pin where you think the place is on our 3D map of Leonida, then lock it in. 5 rounds, 90 seconds each — score on accuracy, speed, and hint frugality.",
  yourNameLabel: "Callsign",
  yourNamePlaceholder: "e.g. ViceRider",
  yourNameHint: "Stored on this device only — shown on your personal leaderboard.",
  startGame: "Start game",
  rename: "Rename",
  saveName: "Save",
  cancel: "Cancel",
  keyboardTitle: "Keyboard controls",
  keyboardControls:
    "Space places a pin at the map center · Arrow keys nudge it · Enter locks it in · Esc clears it · H takes a hint.",
  difficultyEasy: "Vice City Tour",
  difficultyEasyBlurb: "Rockstar-confirmed locations only — famous, region-scale spots.",
  difficultyMedium: "Leonida Explorer",
  difficultyMediumBlurb: "Every eligible location — famous and obscure, mixed.",
  difficultyHard: "Deep Cuts",
  difficultyHardBlurb: "Trailer-confirmed only — districts you studied in the trailers.",
  poolSize: (n: number) => `${n} locations in the pool`,
  bestScore: "Best score",
  gamesPlayed: "Games played",
  fiveRounds: "5 rounds",
  ninetySeconds: "90 s per round",

  // ── Round HUD ──
  roundOf: (round: number, total: number) => `Round ${round} of ${total}`,
  streakLabel: "Streak",
  streakX: (n: number) => `×${n}`,
  timeLeft: (seconds: number) => `${seconds}s left`,
  pause: "Pause",
  resume: "Resume",
  pausedTitle: "Paused",
  pausedNote: "Timer and map are frozen. Resume when you're ready.",
  lockItIn: "Lock it in",
  placePin: "Place pin",
  hint1Label: "Hint 1 · Region intel",
  hint2Label: "Hint 2 · Real-world echo",
  hintUsedLabel: (cost: number) => `Used (−${cost})`,
  hintCostNote: "Each hint costs 100 pts.",
  hintTapCost: (cost: number) => `Tap — −${cost} pts`,
  hintRevealRegion: "Region revealed",
  hintRevealEcho: "Real-world echo revealed",
  hint2Unavailable: "No real-world echo recorded for this location — no hint available here.",
  bothHintsUsed: "Both hints used this round.",
  confirmLocked: "Round locked",

  // ── Result overlay ──
  yourGuess: "Your guess",
  trueLocation: "True location",
  nextRound: "Next round",
  seeResults: "See results",
  roundTimeout: "Time's up!",
  timeoutNote: "The 90 seconds ran out — no points this round, streak reset.",
  approximateHonesty: "Our pin placement is approximate — scored generously.",
  tierLine: (tier: string) => tier,
  errorKm: (km: number) => `${km.toFixed(1)} km off`,
  distancePoints: (pts: number) => `+${pts}`,
  distancePointsLabel: "Distance points",
  hintsLabel: "Hints",
  timeBonusLabel: "Time bonus",
  streakMultLabel: "Streak multiplier",
  hintDeduction: (n: number) => `−${n * 100} (${n} hint${n === 1 ? "" : "s"})`,
  roundTotal: "Round total",
  runningTotal: "Game total",

  // ── Final screen ──
  gameOver: "Game over",
  newBest: "New best!",
  finalStreak: "Final streak",
  bestRound: "Best round",
  avgError: "Average error",
  hintsUsed: "Hints used",
  playAgain: "Play again",
  changeDifficulty: "Change difficulty",
  viewLeaderboard: "View leaderboard",
  shareLabel: "Share score",
  shareCopied: "Share text copied — paste it anywhere.",
  shareText: (score: number, difficulty: string) =>
    `I scored ${score.toLocaleString()} on Find the Location — ${difficulty}. Can you beat it? gta6mapx.com/game/find-the-location`,

  // ── Leaderboard ──
  leaderboardTitle: "Leaderboard",
  leaderboardNote: "Your personal records — stored on this device",
  topGames: "Your top 10 games",
  noGamesYet: "No games yet — play your first round to start the board.",
  lifetimeStats: "Lifetime",
  bestStreak: "Best streak",
  averageScore: "Average score",
  totalScore: "Total score",
  backToGame: "Back to game",
  gameDate: (date: string) => date,
  difficultyLine: (d: string) => d,

  // ── Evidence / clue card ──
  dossierTitle: "Clue dossier",
  clueLabel: "Clue",
  evidenceLabel: "How we know",
  difficultyLabel: "Difficulty",
  difficultyName: (d: string) => d,

  // ── aria-live announcements ──
  announcedGuessPlaced: "Guess placed",
  announcedGuessMoved: "Guess moved",
  announcedGuessCleared: "Guess cleared",
  announcedRoundLocked: "Round locked",
  announcedRoundResult: (roundScore: number, tier: string) =>
    `Round scored ${roundScore} points — ${tier}.`,
  announcedHintRevealed: (hintLabel: string) => `${hintLabel} revealed.`,

  // ── Static fallback (no WebGL) ──
  noWebglTitle: "3D map unavailable on this device",
  noWebglNote:
    "WebGL could not start, so the guessing game can't run here. Try a browser with hardware acceleration enabled.",

  // ── Misc ──
  maxScoreNote: "Max score 9,000",
  difficultyTagline: (mode: string) => `Mode: ${mode}`,
} as const;

export type GameStrings = typeof gameStrings;

/**
 * Single-language audit: every entry is a non-empty string or a function
 * returning one. Also scans for leaked non-English tokens (the competitor
 * shipped German labels inside English mode).
 */
const NON_ENGLISH_TOKENS = [
  "koordinaten",
  "zur position",
  "anwenden",
  "suchen",
  "schließen",
  "spielstart",
  "ergebnis",
];

export function auditGameStringsEnglish(strings: GameStrings): string[] {
  const violations: string[] = [];
  const check = (value: string, key: string) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      violations.push(`${key}: empty or not a string`);
      return;
    }
    const lower = value.toLowerCase();
    for (const token of NON_ENGLISH_TOKENS) {
      if (lower.includes(token)) violations.push(`${key}: contains "${token}"`);
    }
  };
  for (const [key, value] of Object.entries(strings)) {
    if (typeof value === "function") {
      // Probe template functions with representative args. String probes
      // first; numeric probes as fallback for functions taking numbers.
      const probeSets: unknown[][] = [
        ["x", "y"].slice(0, value.length),
        [123, 456].slice(0, value.length),
      ];
      let probed = false;
      for (const args of probeSets) {
        try {
          check(
            (value as (...a: never[]) => string)(...(args as never[])),
            key
          );
          probed = true;
          break;
        } catch {
          /* try the next probe set */
        }
      }
      if (!probed) violations.push(`${key}: template function threw on probe args`);
    } else {
      check(value, key);
    }
  }
  return violations;
}
