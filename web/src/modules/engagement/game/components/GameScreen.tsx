"use client";

// ─── GameScreen.tsx — "Find the Location" state machine ─────────────────────
// Views: start → game (5 rounds) → final; leaderboard is reachable from start
// and final. Owns the 90 s round timer (with pause), hints, scoring, and
// persistence. Honesty is enforced in LOGIC: the round pool is a live
// evidence-status filter, truth coords never render before lock, and the
// result overlay always carries the approximate-pin note.

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gameStrings as S } from "../strings";
import {
  ROUNDS_PER_GAME,
  ROUND_SECONDS,
  canStartGame,
  drawRounds,
  haversineKm,
  scoreRound,
  type RoundScoreResult,
} from "../engine";
import {
  getEligibleTargets,
  type GameDifficulty,
  type RoundTarget,
} from "../gameData";
import {
  applyGameToPlayer,
  loadPlayer,
  saveGameRecord,
  savePlayer,
  type GameRecord,
  type PlayerProfile,
  type RoundRecord,
} from "../storage";
import TimerRing from "./TimerRing";
import ClueCard from "./ClueCard";
import ResultOverlay, { type ResultInfo } from "./ResultOverlay";
import StartScreen from "./StartScreen";
import FinalScreen, { type FinalStats } from "./FinalScreen";
import LeaderboardView from "./LeaderboardView";
import type { GameResultPins } from "./GameMapView";

const GameMapView = dynamic(() => import("./GameMapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#0a0a12]">
      <p className="font-mono text-sm text-[#8b94a3]">Preparing the map…</p>
    </div>
  ),
});

type View = "start" | "game" | "final" | "leaderboard";
type Phase = "playing" | "result";

function makeId(): string {
  return `gg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function GameScreen() {
  const [mounted, setMounted] = useState(false);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [view, setView] = useState<View>("start");

  // Game state
  const [difficulty, setDifficulty] = useState<GameDifficulty>("medium");
  const [rounds, setRounds] = useState<RoundTarget[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [roundKey, setRoundKey] = useState(0);
  const [guess, setGuess] = useState<[number, number] | null>(null);
  const [remaining, setRemaining] = useState(ROUND_SECONDS);
  const [paused, setPaused] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState<[boolean, boolean]>([false, false]);
  const [streak, setStreak] = useState(0);
  const [runningTotal, setRunningTotal] = useState(0);
  const [records, setRecords] = useState<RoundRecord[]>([]);
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null);
  const [mapResult, setMapResult] = useState<GameResultPins | null>(null);
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mobileClueOpen, setMobileClueOpen] = useState(false);
  const [announce, setAnnounce] = useState("");

  const mapApiRef = useRef<{ placeAtCenter: () => void } | null>(null);
  const remainingRef = useRef(ROUND_SECONDS * 1000);
  const stateRef = useRef({ guess, hintsRevealed, streak });
  // Keep the finish-round snapshot ref in sync via effect (never during render).
  useEffect(() => {
    stateRef.current = { guess, hintsRevealed, streak };
  });

  // ── Load the player profile after mount (SSR-safe: no localStorage on server) ──
  // One-shot init — setState-in-effect is intentional here (client-only screen).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPlayer(loadPlayer());
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveName = useCallback(
    (name: string) => {
      setPlayer((prev) => {
        const base = prev ?? loadPlayer();
        const next = { ...base, name };
        savePlayer(next);
        return next;
      });
    },
    []
  );

  // ── Start a fresh 5-round draw ──
  const startGame = useCallback((diff: GameDifficulty) => {
    const pool = getEligibleTargets(diff);
    if (!canStartGame(pool)) return; // pool too small — stay on start screen
    setDifficulty(diff);
    setRounds(drawRounds(pool, ROUNDS_PER_GAME));
    setRoundIndex(0);
    setPhase("playing");
    setRoundKey(1);
    setGuess(null);
    remainingRef.current = ROUND_SECONDS * 1000;
    setRemaining(ROUND_SECONDS);
    setPaused(false);
    setHintsRevealed([false, false]);
    setStreak(0);
    setRunningTotal(0);
    setRecords([]);
    setResultInfo(null);
    setMapResult(null);
    setMapError(false);
    setMobileClueOpen(false);
    setView("game");
  }, []);

  // ── Round timer: deadline-based; pause freezes it (no interval running) ──
  const finishRound = useCallback(
    (timedOut: boolean) => {
      const target = rounds[roundIndex];
      if (!target || phase !== "playing") return;
      const { guess: g, hintsRevealed: hr, streak: st } = stateRef.current;
      const hintsUsed = (hr[0] ? 1 : 0) + (hr[1] ? 1 : 0);
      const elapsedSec = (ROUND_SECONDS * 1000 - remainingRef.current) / 1000;
      const truth: [number, number] = [target.pin.lng, target.pin.lat];
      const errorKm = g ? haversineKm(g[1], g[0], truth[1], truth[0]) : null;
      const score: RoundScoreResult = timedOut
        ? scoreRound({ errorKm: 9999, elapsedSec, streakBefore: st, hintsUsed, timedOut: true })
        : scoreRound({
            errorKm: errorKm ?? 9999,
            elapsedSec,
            streakBefore: st,
            hintsUsed,
            timedOut: false,
          });
      const record: RoundRecord = {
        locationSlug: target.location.slug,
        guessLngLat: g,
        truthLngLat: truth,
        errorKm,
        elapsedSec,
        hintsUsed,
        distanceScore: score.distancePts,
        timeBonus: score.timeBonusPts,
        roundScore: score.roundScore,
      };
      setRecords((prev) => [...prev, record]);
      setStreak(score.streakAfter);
      const total = runningTotal + score.roundScore;
      setRunningTotal(total);
      setResultInfo({
        locationName: target.location.name,
        score,
        errorKm,
        elapsedSec,
        runningTotal: total,
        isLastRound: roundIndex === rounds.length - 1,
        timedOut,
      });
      setMapResult({ guess: g, truth });
      setPhase("result");
      setAnnounce(
        timedOut
          ? "Time's up — no points this round."
          : S.announcedRoundResult(score.roundScore, score.distance.name)
      );
    },
    [rounds, roundIndex, phase, runningTotal]
  );

  useEffect(() => {
    if (view !== "game" || phase !== "playing" || paused) return;
    const deadline = Date.now() + remainingRef.current;
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      remainingRef.current = left;
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) {
        window.clearInterval(id);
        finishRound(true);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [view, phase, paused, roundIndex, finishRound]);

  // ── Player actions ──
  const placeGuess = useCallback((lngLat: [number, number]) => {
    if (phase !== "playing") return;
    setGuess((prev) => {
      setAnnounce(prev ? S.announcedGuessMoved : S.announcedGuessPlaced);
      return lngLat;
    });
  }, [phase]);

  const clearGuess = useCallback(() => {
    setGuess(null);
    setAnnounce(S.announcedGuessCleared);
  }, []);

  const lockGuess = useCallback(() => {
    if (phase !== "playing" || !guess) return;
    setAnnounce(S.announcedRoundLocked);
    finishRound(false);
  }, [phase, guess, finishRound]);

  const takeHint = useCallback(
    (index: 0 | 1) => {
      if (phase !== "playing" || paused) return;
      setHintsRevealed((prev) => {
        if (prev[index]) return prev;
        const next: [boolean, boolean] = [prev[0], prev[1]];
        next[index] = true;
        return next;
      });
      setAnnounce(S.announcedHintRevealed(index === 0 ? "Region intel" : "Real-world echo"));
    },
    [phase, paused]
  );

  // Tracks the highest streak reached during this game (for the record).
  const streakHistoryRef = useRef(0);
  useEffect(() => {
    if (view === "game" && streak > streakHistoryRef.current) {
      streakHistoryRef.current = streak;
    }
  }, [streak, view]);
  useEffect(() => {
    if (view === "game" && roundIndex === 0 && phase === "playing") {
      streakHistoryRef.current = 0;
    }
  }, [view, roundIndex, phase]);

  const nextRound = useCallback(() => {
    if (roundIndex >= rounds.length - 1) {
      // ── Finalize the game record ──
      const totalScore = runningTotal;
      const errors = records.map((r) => r.errorKm).filter((e): e is number => e !== null);
      const game: GameRecord = {
        id: makeId(),
        date: new Date().toISOString(),
        difficulty,
        rounds: records,
        totalScore,
        bestStreak: streakHistoryRef.current,
        avgErrorKm: errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : 0,
        hintsUsed: records.reduce((a, r) => a + r.hintsUsed, 0),
      };
      saveGameRecord(game);
      const prevBest = (player ?? loadPlayer()).bestScore;
      const newBest = totalScore > prevBest && totalScore > 0;
      setPlayer((prev) => {
        const base = prev ?? loadPlayer();
        return applyGameToPlayer(base, game);
      });
      setIsNewBest(newBest);
      const bestRound = records.length > 0 ? Math.max(...records.map((r) => r.roundScore)) : 0;
      setFinalStats({
        totalScore,
        bestRound,
        avgErrorKm: errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
        hintsUsed: game.hintsUsed,
        finalStreak: streakHistoryRef.current,
        difficulty,
        rounds: records,
      });
      setView("final");
      return;
    }
    setRoundIndex((i) => i + 1);    setRoundKey((k) => k + 1);
    setPhase("playing");
    setGuess(null);
    remainingRef.current = ROUND_SECONDS * 1000;
    setRemaining(ROUND_SECONDS);
    setHintsRevealed([false, false]);
    setResultInfo(null);
    setMapResult(null);
    setMobileClueOpen(false);
  }, [roundIndex, rounds.length, runningTotal, records, difficulty, player]);

  const target = rounds[roundIndex] ?? null;
  const hintsUsedCount = (hintsRevealed[0] ? 1 : 0) + (hintsRevealed[1] ? 1 : 0);

  if (!mounted || !player) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a12]">
        <p className="font-mono text-sm text-[#8b94a3]">Loading…</p>
      </div>
    );
  }

  if (view === "start") {
    return (
      <StartScreen
        player={player}
        onSaveName={saveName}
        onStart={startGame}
        onLeaderboard={() => setView("leaderboard")}
      />
    );
  }

  if (view === "leaderboard") {
    return (
      <LeaderboardView
        player={player}
        onSaveName={saveName}
        onBack={() => setView(finalStats ? "final" : "start")}
      />
    );
  }

  if (view === "final" && finalStats) {
    return (
      <FinalScreen
        stats={finalStats}
        isNewBest={isNewBest}
        onPlayAgain={() => startGame(difficulty)}
        onChangeDifficulty={() => {
          setFinalStats(null);
          setView("start");
        }}
        onLeaderboard={() => setView("leaderboard")}
      />
    );
  }

  // ══ Game view ══
  if (!target) return null;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0a12]">
      {/* aria-live announcements */}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* HUD bar */}
      <header className="z-20 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#0a0a12]/90 px-3 py-2 backdrop-blur-xl sm:px-4">
        <div className="flex items-center gap-3">
          <TimerRing remaining={remaining} total={ROUND_SECONDS} paused={paused} />
          <div>
            <p className="font-mono text-xs text-[#8b94a3]">
              {S.roundOf(roundIndex + 1, rounds.length)}
            </p>
            <p className="text-sm font-semibold text-white">
              {S.streakLabel}{" "}
              <span className={streak >= 2 ? "text-[#ff2d78]" : "text-[#8b94a3]"}>
                {S.streakX(streak)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mapApiRef.current?.placeAtCenter()}
            disabled={phase !== "playing" || paused}
            className="btn-ghost min-h-11 rounded-lg px-3 text-sm font-semibold disabled:opacity-50"
          >
            {S.placePin}
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            disabled={phase !== "playing"}
            aria-pressed={paused}
            className="btn-ghost min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold disabled:opacity-50"
          >
            {paused ? S.resume : S.pause}
          </button>
        </div>
      </header>

      {/* Map + clue + overlays */}
      <div className="relative min-h-0 flex-1">
        {mapError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <h2 className="text-lg font-bold text-white">{S.noWebglTitle}</h2>
            <p className="max-w-md text-sm text-[#8b94a3]">{S.noWebglNote}</p>
            <button
              type="button"
              onClick={() => {
                setFinalStats(null);
                setView("start");
              }}
              className="btn-ghost mt-2 min-h-11 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              {S.backToGame}
            </button>
          </div>
        ) : (
          <GameMapView
            roundKey={roundKey}
            guess={phase === "playing" ? guess : null}
            onPlace={placeGuess}
            result={mapResult}
            paused={paused}
            interactive={phase === "playing"}
            onLock={lockGuess}
            onClear={clearGuess}
            onHint={() => takeHint(hintsRevealed[0] ? 1 : 0)}
            onMapError={() => setMapError(true)}
            apiRef={mapApiRef}
          />
        )}

        {/* Clue dossier — desktop side panel / mobile collapsible sheet */}
        {phase === "playing" && !paused && (
          <>
            <div className="absolute left-3 top-3 z-10 hidden w-80 md:block">
              <ClueCard
                target={target}
                difficulty={difficulty}
                roundLabel={S.roundOf(roundIndex + 1, rounds.length)}
                hintsUsed={hintsUsedCount}
                hintsRevealed={hintsRevealed}
                onHint={takeHint}
              />
            </div>
            <div className="absolute inset-x-0 bottom-20 z-10 px-3 md:hidden">
              <button
                type="button"
                onClick={() => setMobileClueOpen((o) => !o)}
                aria-expanded={mobileClueOpen}
                className="btn-ghost min-h-11 w-full rounded-xl px-4 py-2.5 text-sm font-bold"
              >
                {S.dossierTitle} {mobileClueOpen ? "▾" : "▸"}
              </button>
              {mobileClueOpen && (
                <div className="mt-2 max-h-[42dvh] overflow-y-auto">
                  <ClueCard
                    target={target}
                    difficulty={difficulty}
                    roundLabel={S.roundOf(roundIndex + 1, rounds.length)}
                    hintsUsed={hintsUsedCount}
                    hintsRevealed={hintsRevealed}
                    onHint={takeHint}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Pause overlay */}
        {paused && phase === "playing" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center">
            <h2 className="font-display text-3xl tracking-wide text-white">{S.pausedTitle}</h2>
            <p className="max-w-sm text-sm text-[#c3cad4]">{S.pausedNote}</p>
            <button
              type="button"
              onClick={() => setPaused(false)}
              className="btn-neon min-h-11 rounded-xl px-8 py-2.5 font-bold"
            >
              {S.resume}
            </button>
          </div>
        )}

        {/* Result overlay — desktop right panel / mobile bottom sheet */}
        {phase === "result" && resultInfo && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:w-96 md:p-0">
            <ResultOverlay info={resultInfo} onNext={nextRound} />
          </div>
        )}
      </div>

      {/* Sticky lock button */}
      {phase === "playing" && (
        <div className="z-20 shrink-0 border-t border-white/10 bg-[#0a0a12]/90 px-4 py-3 backdrop-blur-xl">
          <button
            type="button"
            onClick={lockGuess}
            disabled={!guess || paused}
            className="btn-neon mx-auto block min-h-11 w-full max-w-md rounded-xl px-6 py-3 text-lg font-bold disabled:opacity-50"
          >
            {S.lockItIn}
          </button>
        </div>
      )}
    </div>
  );
}
