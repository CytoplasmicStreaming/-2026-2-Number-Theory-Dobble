import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Lightbulb,
  Trophy,
  Zap,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  DobbleCard,
  generateProjectivePlaneDeck,
  generateVariant3CardDeck,
  shuffleCards,
  findCommonSymbol,
  find3CardsCommonSymbol,
} from './game/dobbleMath';
import { SYMBOLS } from './game/symbols';
import { DobbleCardView } from './game/DobbleCardView';
import { soundManager } from './game/soundEffects';

type GameType = 'standard' | 'variant_3card';
type GameMode = 'human_only' | 'vs_ai' | 'auto_demo';

interface Player {
  id: number;
  name: string;
  color: string;
  accentBg: string;
  isBot: boolean;
  topCard: DobbleCard;
  collectedCount: number;
}

const PLAYER_THEMES = [
  { name: '블루', color: '#2563eb', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: '에메랄드', color: '#059669', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: '로즈', color: '#e11d48', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  { name: '퍼플', color: '#9333ea', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: '앰버', color: '#d97706', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: '시안', color: '#0891b2', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { name: '오렌지', color: '#ea580c', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: '인디고', color: '#4f46e5', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
];

export default function App() {
  // Game Type: Standard (1 pile, 57 cards) vs Variant (2 piles, 8 cards, 3-card match)
  const [gameType, setGameType] = useState<GameType>('standard');

  // Decks
  const standardMasterDeck = useMemo(() => generateProjectivePlaneDeck(), []);
  const variantMasterDeck = useMemo(() => generateVariant3CardDeck(), []);

  // Settings
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [gameMode, setGameMode] = useState<GameMode>('human_only');
  const [botSpeed, setBotSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [showHints, setShowHints] = useState<boolean>(false);

  // Dynamic viewport sizing for guaranteed non-overlap
  const arenaRef = useRef<HTMLDivElement>(null);
  const [arenaDim, setArenaDim] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 700,
  });

  // Game state
  const [players, setPlayers] = useState<Player[]>([]);

  // Standard Mode Pile
  const [centerCard, setCenterCard] = useState<DobbleCard | null>(null);
  const [drawPile, setDrawPile] = useState<DobbleCard[]>([]);

  // Variant Mode 2 Piles
  const [pileA, setPileA] = useState<DobbleCard[]>([]);
  const [pileB, setPileB] = useState<DobbleCard[]>([]);

  // Pending pile choice modal for human player in variant mode
  const [pendingVariantClaim, setPendingVariantClaim] = useState<{
    playerId: number;
    symbolId: number;
    symbolName: string;
  } | null>(null);

  const [gameOver, setGameOver] = useState<boolean>(false);

  // Callouts & feedback
  const calloutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [lastMatchCallout, setLastMatchCallout] = useState<{
    playerId: number;
    symbolName: string;
    symbolId: number;
  } | null>(null);
  const [mismatchError, setMismatchError] = useState<{
    playerId: number;
    symbolName: string;
  } | null>(null);

  // Trigger match callout and automatically clear after 850ms
  const triggerMatchCallout = useCallback(
    (playerId: number, symName: string, symId: number) => {
      if (calloutTimerRef.current) {
        clearTimeout(calloutTimerRef.current);
      }
      setLastMatchCallout({
        playerId,
        symbolName: symName,
        symbolId: symId,
      });

      calloutTimerRef.current = setTimeout(() => {
        setLastMatchCallout(null);
      }, 850);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (calloutTimerRef.current) clearTimeout(calloutTimerRef.current);
    };
  }, []);

  // Measure arena size
  useEffect(() => {
    const handleResize = () => {
      if (arenaRef.current) {
        setArenaDim({
          width: arenaRef.current.clientWidth,
          height: arenaRef.current.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sound sync
  useEffect(() => {
    soundManager.enabled = soundOn;
  }, [soundOn]);

  // Adjust player count if switching between game types
  const allowedPlayerCounts = useMemo(() => {
    return gameType === 'standard' ? [2, 3, 4, 5, 6, 7, 8] : [2, 3, 4, 5];
  }, [gameType]);

  useEffect(() => {
    if (!allowedPlayerCounts.includes(playerCount)) {
      setPlayerCount(allowedPlayerCounts[allowedPlayerCounts.length - 1]);
    }
  }, [allowedPlayerCounts, playerCount]);

  // Fireworks on victory
  const triggerWinnerFireworks = useCallback(() => {
    soundManager.playVictory();
    const duration = 2500;
    const end = Date.now() + duration;

    const interval = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }
      confetti({
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        origin: {
          x: Math.random() * 0.6 + 0.2,
          y: Math.random() * 0.5 + 0.2,
        },
        colors: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
      });
    }, 280);
  }, []);

  // Start new game
  const startNewGame = useCallback(() => {
    setPendingVariantClaim(null);
    setLastMatchCallout(null);
    setMismatchError(null);
    setIsPaused(false);
    setGameOver(false);

    if (gameType === 'standard') {
      const shuffled = shuffleCards(standardMasterDeck);
      const initialPlayers: Player[] = [];

      for (let i = 0; i < playerCount; i++) {
        const theme = PLAYER_THEMES[i % PLAYER_THEMES.length];
        let isBot = false;
        let pName = `플레이어 ${i + 1}`;

        if (gameMode === 'human_only') {
          isBot = false;
          pName = `플레이어 ${i + 1}`;
        } else if (gameMode === 'vs_ai') {
          isBot = i !== 0;
          pName = i === 0 ? '나 (P1)' : `봇 ${i + 1}`;
        } else if (gameMode === 'auto_demo') {
          isBot = true;
          pName = `시연봇 ${i + 1}`;
        }

        initialPlayers.push({
          id: i + 1,
          name: pName,
          color: theme.color,
          accentBg: theme.bg,
          isBot: isBot,
          topCard: shuffled[i],
          collectedCount: 1,
        });
      }

      const remainingCards = shuffled.slice(playerCount);
      setPlayers(initialPlayers);
      setCenterCard(remainingCards[0] || null);
      setDrawPile(remainingCards.slice(1));
      setPileA([]);
      setPileB([]);
    } else {
      // Variant Mode (8 cards, 2 piles)
      const shuffled = shuffleCards(variantMasterDeck);
      const initialPlayers: Player[] = [];

      for (let i = 0; i < playerCount; i++) {
        const theme = PLAYER_THEMES[i % PLAYER_THEMES.length];
        let isBot = false;
        let pName = `플레이어 ${i + 1}`;

        if (gameMode === 'human_only') {
          isBot = false;
          pName = `플레이어 ${i + 1}`;
        } else if (gameMode === 'vs_ai') {
          isBot = i !== 0;
          pName = i === 0 ? '나 (P1)' : `봇 ${i + 1}`;
        } else if (gameMode === 'auto_demo') {
          isBot = true;
          pName = `시연봇 ${i + 1}`;
        }

        initialPlayers.push({
          id: i + 1,
          name: pName,
          color: theme.color,
          accentBg: theme.bg,
          isBot: isBot,
          topCard: shuffled[i],
          collectedCount: 1,
        });
      }

      // Remaining cards split into 2 piles as equally as possible
      const remaining = shuffled.slice(playerCount);
      const half = Math.ceil(remaining.length / 2);
      const newPileA = remaining.slice(0, half);
      const newPileB = remaining.slice(half);

      setPlayers(initialPlayers);
      setCenterCard(null);
      setDrawPile([]);
      setPileA(newPileA);
      setPileB(newPileB);
    }

    soundManager.playCardDeal();
  }, [gameType, standardMasterDeck, variantMasterDeck, playerCount, gameMode]);

  // Restart on settings change
  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  // Standard Mode: claim card
  const handleStandardClaim = useCallback(
    (playerId: number, symbolId: number) => {
      if (!centerCard || gameOver) return;

      const playerIndex = players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) return;
      const player = players[playerIndex];

      const commonId = findCommonSymbol(player.topCard, centerCard);

      if (symbolId === commonId) {
        const symDef = SYMBOLS.find((s) => s.id === symbolId);
        const symName = symDef ? symDef.name : '심볼';

        soundManager.playMatchSuccess();
        setMismatchError(null);
        triggerMatchCallout(player.id, symName, symbolId);

        const nextDrawPile = [...drawPile];
        const newPlayerTopCard = centerCard;

        setPlayers((prev) =>
          prev.map((p, idx) => {
            if (idx === playerIndex) {
              return {
                ...p,
                topCard: newPlayerTopCard,
                collectedCount: p.collectedCount + 1,
              };
            }
            return p;
          })
        );

        if (nextDrawPile.length > 0) {
          setCenterCard(nextDrawPile[0]);
          setDrawPile(nextDrawPile.slice(1));
        } else {
          setCenterCard(null);
          setDrawPile([]);
          setGameOver(true);
          triggerWinnerFireworks();
        }
      } else {
        const symDef = SYMBOLS.find((s) => s.id === symbolId);
        const symName = symDef ? symDef.name : '심볼';
        soundManager.playWrong();
        setMismatchError({
          playerId: player.id,
          symbolName: symName,
        });
        setTimeout(() => setMismatchError(null), 1200);
      }
    },
    [centerCard, gameOver, players, drawPile, triggerWinnerFireworks, triggerMatchCallout]
  );

  // Variant Mode: claim card from chosen pile ('A' | 'B')
  const executeVariantClaim = useCallback(
    (playerId: number, chosenPile: 'A' | 'B', symName: string, symId: number) => {
      const playerIndex = players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) return;

      const sourcePile = chosenPile === 'A' ? pileA : pileB;
      if (sourcePile.length === 0) return;

      const takenCard = sourcePile[0];
      const nextPile = sourcePile.slice(1);

      soundManager.playMatchSuccess();
      setMismatchError(null);
      setPendingVariantClaim(null);
      triggerMatchCallout(playerId, symName, symId);

      // Update player top card and score
      setPlayers((prev) =>
        prev.map((p, idx) => {
          if (idx === playerIndex) {
            return {
              ...p,
              topCard: takenCard,
              collectedCount: p.collectedCount + 1,
            };
          }
          return p;
        })
      );

      let nextPileA = pileA;
      let nextPileB = pileB;

      if (chosenPile === 'A') {
        nextPileA = nextPile;
        setPileA(nextPileA);
      } else {
        nextPileB = nextPile;
        setPileB(nextPileB);
      }

      // Check if EITHER pile is now empty (Rule 6: 두 더미 중 한 더미라도 남아 있는 카드가 없을 때 종료)
      if (nextPileA.length === 0 || nextPileB.length === 0) {
        setGameOver(true);
        triggerWinnerFireworks();
      }
    },
    [pileA, pileB, players, triggerWinnerFireworks, triggerMatchCallout]
  );

  // Variant Mode: process symbol click
  const handleVariantSymbolClick = useCallback(
    (playerId: number, symbolId: number, preferredPile?: 'A' | 'B') => {
      if (pileA.length === 0 || pileB.length === 0 || gameOver) return;

      const playerIndex = players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) return;
      const player = players[playerIndex];

      const cardA = pileA[0];
      const cardB = pileB[0];
      const commonId = find3CardsCommonSymbol(player.topCard, cardA, cardB);

      if (symbolId === commonId) {
        const symDef = SYMBOLS.find((s) => s.id === symbolId);
        const symName = symDef ? symDef.name : '심볼';

        if (preferredPile) {
          // Player clicked on a specific pile directly!
          executeVariantClaim(playerId, preferredPile, symName, symbolId);
        } else if (player.isBot) {
          // Bot automatically picks larger pile (or random if equal)
          const chosen = pileA.length >= pileB.length ? 'A' : 'B';
          executeVariantClaim(playerId, chosen, symName, symbolId);
        } else {
          // Human player clicked symbol on their own card: prompt to select pile!
          setPendingVariantClaim({
            playerId,
            symbolId,
            symbolName: symName,
          });
        }
      } else {
        const symDef = SYMBOLS.find((s) => s.id === symbolId);
        const symName = symDef ? symDef.name : '심볼';
        soundManager.playWrong();
        setMismatchError({
          playerId: player.id,
          symbolName: symName,
        });
        setTimeout(() => setMismatchError(null), 1200);
      }
    },
    [pileA, pileB, gameOver, players, executeVariantClaim]
  );

  // Unified symbol click on player's card
  const handlePlayerSymbolClick = (playerId: number, symbolId: number) => {
    if (gameType === 'standard') {
      handleStandardClaim(playerId, symbolId);
    } else {
      handleVariantSymbolClick(playerId, symbolId);
    }
  };

  // Bot timer loop
  useEffect(() => {
    if (gameOver || isPaused) return;

    const botPlayers = players.filter((p) => p.isBot);
    if (botPlayers.length === 0) return;

    let baseDelay = 2200;
    if (botSpeed === 'fast') baseDelay = 1200;
    if (botSpeed === 'slow') baseDelay = 3600;

    if (gameType === 'standard') {
      if (!centerCard) return;

      const candidates = botPlayers
        .map((bot) => {
          const commonId = findCommonSymbol(bot.topCard, centerCard);
          const jitter = (Math.random() - 0.4) * (baseDelay * 0.5);
          const delay = Math.max(800, Math.round(baseDelay + jitter));
          return {
            botId: bot.id,
            commonId: commonId,
            delay: delay,
          };
        })
        .filter((c) => c.commonId !== null);

      if (candidates.length === 0) return;
      candidates.sort((a, b) => a.delay - b.delay);
      const winner = candidates[0];

      const timer = setTimeout(() => {
        if (winner.commonId !== null) {
          handleStandardClaim(winner.botId, winner.commonId);
        }
      }, winner.delay);

      return () => clearTimeout(timer);
    } else {
      // Variant 3-card game
      if (pileA.length === 0 || pileB.length === 0) return;
      const cardA = pileA[0];
      const cardB = pileB[0];

      const candidates = botPlayers
        .map((bot) => {
          const commonId = find3CardsCommonSymbol(bot.topCard, cardA, cardB);
          const jitter = (Math.random() - 0.4) * (baseDelay * 0.5);
          const delay = Math.max(800, Math.round(baseDelay + jitter));
          return {
            botId: bot.id,
            commonId: commonId,
            delay: delay,
          };
        })
        .filter((c) => c.commonId !== null);

      if (candidates.length === 0) return;
      candidates.sort((a, b) => a.delay - b.delay);
      const winner = candidates[0];

      const timer = setTimeout(() => {
        if (winner.commonId !== null) {
          const chosen = pileA.length >= pileB.length ? 'A' : 'B';
          const symDef = SYMBOLS.find((s) => s.id === winner.commonId);
          executeVariantClaim(winner.botId, chosen, symDef?.name || '', winner.commonId);
        }
      }, winner.delay);

      return () => clearTimeout(timer);
    }
  }, [
    gameType,
    centerCard,
    pileA,
    pileB,
    gameOver,
    isPaused,
    players,
    botSpeed,
    handleStandardClaim,
    executeVariantClaim,
  ]);

  // Click on center card (Standard)
  const handleStandardCenterSymbolClick = (symbolId: number) => {
    if (!centerCard || gameOver) return;

    if (gameMode === 'vs_ai') {
      const p1 = players[0];
      if (p1 && p1.topCard.symbolIds.includes(symbolId)) {
        handleStandardClaim(p1.id, symbolId);
        return;
      }
    }

    const matchPlayer = players.find((p) => p.topCard.symbolIds.includes(symbolId));
    if (matchPlayer) {
      handleStandardClaim(matchPlayer.id, symbolId);
    } else {
      soundManager.playWrong();
      setMismatchError({
        playerId: 0,
        symbolName: SYMBOLS.find((s) => s.id === symbolId)?.name || '',
      });
      setTimeout(() => setMismatchError(null), 1200);
    }
  };

  // Find winner
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => b.collectedCount - a.collectedCount);
  }, [players]);

  const winningScore = sortedPlayers.length > 0 ? sortedPlayers[0].collectedCount : 0;

  // -------------------------------------------------------------
  // NON-OVERLAPPING GEOMETRIC CALCULATION
  // -------------------------------------------------------------
  const { playerCardSize, centerCardSize, orbitRadiusX, orbitRadiusY } = useMemo(() => {
    const W = Math.max(arenaDim.width, 320);
    const H = Math.max(arenaDim.height, 320);
    const minD = Math.min(W, H);
    const N = Math.max(playerCount, 2);

    let baseCardSize: number;
    let baseCenterSize: number;

    if (N === 2) {
      baseCardSize = Math.min(155, Math.round(minD * 0.23));
      baseCenterSize = Math.min(gameType === 'variant_3card' ? 140 : 165, Math.round(minD * 0.24));
    } else if (N <= 4) {
      baseCardSize = Math.min(135, Math.round(minD * 0.20));
      baseCenterSize = Math.min(gameType === 'variant_3card' ? 130 : 150, Math.round(minD * 0.22));
    } else if (N <= 6) {
      baseCardSize = Math.min(120, Math.round(minD * 0.17));
      baseCenterSize = Math.min(130, Math.round(minD * 0.19));
    } else {
      baseCardSize = Math.min(105, Math.round(minD * 0.15));
      baseCenterSize = Math.min(120, Math.round(minD * 0.17));
    }

    baseCardSize = Math.max(85, baseCardSize);
    baseCenterSize = Math.max(95, baseCenterSize);

    // Radii of orbit
    const maxRadiusY = H / 2 - baseCardSize / 2 - 46;
    const maxRadiusX = W / 2 - baseCardSize / 2 - 40;

    const centerSpan = gameType === 'variant_3card' ? baseCenterSize * 2 + 16 : baseCenterSize;
    const minCenterClearance = centerSpan / 2 + baseCardSize / 2 + 24;

    const rY = Math.max(minCenterClearance, Math.min(maxRadiusY, H * 0.36));
    const rX =
      N === 2
        ? Math.max(minCenterClearance, Math.min(W * 0.33, maxRadiusX))
        : Math.max(minCenterClearance, Math.min(maxRadiusX, W * 0.38));

    return {
      playerCardSize: baseCardSize,
      centerCardSize: baseCenterSize,
      orbitRadiusX: rX,
      orbitRadiusY: rY,
    };
  }, [arenaDim, playerCount, gameType]);

  // Position calculation for each player in pixels relative to center
  const getPlayerPos = (index: number, total: number) => {
    if (total === 2) {
      // 2 players: Left (P1) and Right (P2)
      const x = index === 0 ? -orbitRadiusX : orbitRadiusX;
      const y = 0;
      const angle = index === 0 ? Math.PI : 0;
      return { x, y, angle };
    }

    // 3 or more players: radial orbit starting at bottom
    const baseAngle = Math.PI / 2;
    const angleStep = (2 * Math.PI) / total;
    const angle = baseAngle + index * angleStep;

    const x = orbitRadiusX * Math.cos(angle);
    const y = orbitRadiusY * Math.sin(angle);

    return { x, y, angle };
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-slate-800 font-sans select-none">
      {/* ======================================================== */}
      {/* CLEAN WHITE HEADER FOR SETTINGS & CONTROLS ONLY          */}
      {/* ======================================================== */}
      <header className="flex-none bg-white border-b border-slate-200 px-4 py-2 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Brand & Game Type Switcher */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                D
              </div>
              <span className="text-base font-black tracking-tight text-slate-900 leading-none">
                DOBBLE
              </span>
            </div>

            {/* Game Type Selector (Standard vs Variant) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setGameType('standard')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  gameType === 'standard'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="기본 도블: 중앙 1더미, 57장 카드, 2카드 매칭"
              >
                기본 도블 (1더미)
              </button>

              <button
                onClick={() => setGameType('variant_3card')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  gameType === 'variant_3card'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="변형 도블: 중앙 2더미, 8장 카드, 3카드 공통 심볼 매칭"
              >
                <Layers size={13} className="text-amber-500" />
                변형 도블 (2더미)
              </button>
            </div>
          </div>

          {/* Center: Mode & Player Count */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Selector */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setGameMode('human_only')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  gameMode === 'human_only'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users size={13} />
                사람끼리
              </button>

              <button
                onClick={() => setGameMode('vs_ai')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  gameMode === 'vs_ai'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                나 vs AI
              </button>

              <button
                onClick={() => setGameMode('auto_demo')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  gameMode === 'auto_demo'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                자동 시연
              </button>
            </div>

            {/* Player Count */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 pl-1.5">인원:</span>
              <div className="flex items-center gap-0.5">
                {allowedPlayerCounts.map((count) => (
                  <button
                    key={count}
                    onClick={() => setPlayerCount(count)}
                    className={`w-5.5 h-5.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                      playerCount === count
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Bot Speed & Pause */}
            {(gameMode === 'vs_ai' || gameMode === 'auto_demo') && (
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 pl-1">속도:</span>
                {(['slow', 'normal', 'fast'] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setBotSpeed(spd)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      botSpeed === spd
                        ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {spd === 'slow' ? '여유' : spd === 'normal' ? '보통' : '빠름'}
                  </button>
                ))}

                {gameMode === 'auto_demo' && (
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                  >
                    {isPaused ? <Play size={12} className="text-emerald-600" /> : <Pause size={12} />}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Actions, Hints, Sound, Deck Counter */}
          <div className="flex items-center gap-1.5">
            {/* Remaining Pile Counter */}
            <div className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
              <span className="text-slate-500">남은 카드:</span>
              <span className="font-mono font-black text-indigo-600">
                {gameType === 'standard'
                  ? `${drawPile.length + (centerCard ? 1 : 0)}/57`
                  : `${pileA.length + pileB.length}/8 (더미1: ${pileA.length}, 더미2: ${pileB.length})`}
              </span>
            </div>

            {/* Hint Button */}
            <button
              onClick={() => setShowHints(!showHints)}
              className={`p-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                showHints
                  ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              title={showHints ? '공통 그림 힌트 끄기' : '공통 그림 힌트 켜기'}
            >
              <Lightbulb size={15} />
            </button>

            {/* Sound Button */}
            <button
              onClick={() => setSoundOn(!soundOn)}
              className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            {/* Restart Button */}
            <button
              onClick={startNewGame}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw size={13} />
              <span>새 게임</span>
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* MAIN GAME ARENA                                          */}
      {/* ======================================================== */}
      <main
        ref={arenaRef}
        className="flex-1 relative w-full h-full overflow-hidden bg-slate-50/50 flex items-center justify-center p-2"
      >
        {/* Soft Arena Circular Table Contour */}
        <div
          className="absolute rounded-full border border-slate-200/70 bg-white/70 shadow-sm pointer-events-none transition-all duration-300"
          style={{
            width: Math.min(arenaDim.width * 0.94, orbitRadiusX * 2 + playerCardSize + 60),
            height:
              playerCount === 2
                ? Math.min(arenaDim.height * 0.65, Math.max(centerCardSize, playerCardSize) + 110)
                : Math.min(arenaDim.height * 0.92, orbitRadiusY * 2 + playerCardSize + 60),
          }}
        />

        {/* ------------------------------------------------------ */}
        {/* CENTER DECKS                                           */}
        {/* ------------------------------------------------------ */}
        <div className="absolute z-20 flex flex-col items-center justify-center">
          {gameType === 'standard' ? (
            /* Standard: 1 Center Card */
            centerCard ? (
              <div className="relative flex flex-col items-center">
                <DobbleCardView
                  card={centerCard}
                  size={centerCardSize}
                  stackCount={drawPile.length + 1}
                  highlightSymbolId={lastMatchCallout?.symbolId ?? null}
                  onSymbolClick={handleStandardCenterSymbolClick}
                  isInteractive={true}
                  label="중앙 카드 더미"
                  badge={
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-200">
                      {drawPile.length + 1}장
                    </span>
                  }
                />
                <div className="mt-1 text-[11px] text-slate-500 font-medium">
                  {gameMode === 'human_only'
                    ? '내 카드와 일치하는 그림을 찾아 클릭!'
                    : '일치하는 공통 그림을 클릭하세요'}
                </div>
              </div>
            ) : (
              <div
                className="rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-white shadow-sm"
                style={{ width: centerCardSize, height: centerCardSize }}
              >
                <Trophy size={32} className="text-amber-500 mb-1" />
                <span className="text-xs font-bold text-slate-700">더미 소진!</span>
                <span className="text-[10px] text-slate-400">게임 완료</span>
              </div>
            )
          ) : (
            /* Variant: 2 Center Piles (더미 1 & 더미 2) */
            pileA.length > 0 && pileB.length > 0 ? (
              <div className="relative flex flex-col items-center">
                {/* 2 Piles Side by Side */}
                <div className="flex items-center gap-4 sm:gap-6">
                  {/* Pile A */}
                  <div className="flex flex-col items-center">
                    <DobbleCardView
                      card={pileA[0]}
                      size={centerCardSize}
                      stackCount={pileA.length}
                      highlightSymbolId={lastMatchCallout?.symbolId ?? null}
                      onSymbolClick={(symId) => {
                        const p1 = players[0];
                        if (p1) handleVariantSymbolClick(p1.id, symId, 'A');
                      }}
                      isInteractive={true}
                      label="더미 1"
                      badge={
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-200">
                          {pileA.length}장
                        </span>
                      }
                    />
                  </div>

                  {/* Intersect icon */}
                  <div className="flex flex-col items-center text-slate-400">
                    <span className="text-xs font-black text-slate-500">+</span>
                  </div>

                  {/* Pile B */}
                  <div className="flex flex-col items-center">
                    <DobbleCardView
                      card={pileB[0]}
                      size={centerCardSize}
                      stackCount={pileB.length}
                      highlightSymbolId={lastMatchCallout?.symbolId ?? null}
                      onSymbolClick={(symId) => {
                        const p1 = players[0];
                        if (p1) handleVariantSymbolClick(p1.id, symId, 'B');
                      }}
                      isInteractive={true}
                      label="더미 2"
                      badge={
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-200">
                          {pileB.length}장
                        </span>
                      }
                    />
                  </div>
                </div>

                {/* Subtitle instructions */}
                <div className="mt-2 text-[11px] text-slate-600 font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
                  손바닥 카드 + 더미1 + 더미2 = 세 카드의 공통 그림을 찾으세요!
                </div>

                {/* Human Pile Choice Modal if pending */}
                {pendingVariantClaim && (
                  <div className="absolute -top-16 z-50 flex items-center gap-2 p-2 rounded-2xl bg-white border-2 border-indigo-500 shadow-xl animate-bounce">
                    <span className="text-xs font-bold text-slate-800 pl-1">
                      &quot;{pendingVariantClaim.symbolName}&quot; 정답! 가져갈 더미:
                    </span>
                    <button
                      onClick={() =>
                        executeVariantClaim(
                          pendingVariantClaim.playerId,
                          'A',
                          pendingVariantClaim.symbolName,
                          pendingVariantClaim.symbolId
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer shadow-xs"
                    >
                      더미 1
                    </button>
                    <button
                      onClick={() =>
                        executeVariantClaim(
                          pendingVariantClaim.playerId,
                          'B',
                          pendingVariantClaim.symbolName,
                          pendingVariantClaim.symbolId
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer shadow-xs"
                    >
                      더미 2
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className="rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-white shadow-sm"
                  style={{ width: centerCardSize, height: centerCardSize }}
                >
                  <Trophy size={32} className="text-amber-500 mb-1" />
                  <span className="text-xs font-bold text-slate-700">더미 소진!</span>
                  <span className="text-[10px] text-slate-400">게임 완료</span>
                </div>
              </div>
            )
          )}
        </div>

        {/* ------------------------------------------------------ */}
        {/* SURROUNDING PLAYERS                                    */}
        {/* ------------------------------------------------------ */}
        {players.map((player, idx) => {
          const { x, y } = getPlayerPos(idx, players.length);
          const isWinner = gameOver && player.collectedCount === winningScore;
          const hasCallout = lastMatchCallout?.playerId === player.id;
          const hasMismatch = mismatchError?.playerId === player.id;

          // Hint calculation
          let hintSymbolId: number | null = null;
          if (showHints) {
            if (gameType === 'standard' && centerCard) {
              hintSymbolId = findCommonSymbol(player.topCard, centerCard);
            } else if (gameType === 'variant_3card' && pileA.length > 0 && pileB.length > 0) {
              hintSymbolId = find3CardsCommonSymbol(player.topCard, pileA[0], pileB[0]);
            }
          }

          const activeHighlight = hasCallout ? lastMatchCallout?.symbolId : hintSymbolId;

          const style: React.CSSProperties = {
            position: 'absolute',
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: 'translate(-50%, -50%)',
            zIndex: hasCallout ? 30 : 15,
          };

          return (
            <div
              key={player.id}
              style={style}
              className="flex flex-col items-center transition-all duration-200"
            >
              {/* Shout Speech Bubble */}
              {hasCallout && (
                <div className="absolute -top-10 z-40 animate-bounce flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-slate-900 font-black text-xs shadow-md border border-amber-300 whitespace-nowrap">
                  <Zap size={13} className="fill-slate-900" />
                  <span>&quot;{lastMatchCallout.symbolName}!&quot;</span>
                </div>
              )}

              {/* Mismatch Alert */}
              {hasMismatch && (
                <div className="absolute -top-9 z-40 animate-pulse px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[11px] shadow-sm whitespace-nowrap">
                  일치하지 않음!
                </div>
              )}

              {/* The Player's Card */}
              <DobbleCardView
                card={player.topCard}
                size={playerCardSize}
                stackCount={player.collectedCount}
                highlightSymbolId={activeHighlight}
                onSymbolClick={(symId) => handlePlayerSymbolClick(player.id, symId)}
                isInteractive={true}
                isWinner={isWinner}
              />

              {/* Player Tag */}
              <div
                className={`mt-1.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${
                  isWinner
                    ? 'bg-amber-400 text-slate-900 border-amber-400 shadow-md ring-2 ring-amber-300'
                    : 'bg-white text-slate-700 border-slate-200 shadow-xs'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                <span className="truncate max-w-[85px]">{player.name}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-800 font-mono font-black text-[11px]">
                  {player.collectedCount}장
                </span>
              </div>
            </div>
          );
        })}

        {/* ------------------------------------------------------ */}
        {/* GAME OVER CELEBRATION MODAL                            */}
        {/* ------------------------------------------------------ */}
        {gameOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 border border-amber-200 flex items-center justify-center animate-bounce">
                <Trophy size={32} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900">게임 종료!</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {gameType === 'standard'
                    ? '중앙 더미의 카드가 모두 소진되었습니다.'
                    : '중앙 더미 중 하나가 소진되었습니다.'}
                </p>
              </div>

              {/* Leaderboard */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5 max-h-52 overflow-y-auto">
                {sortedPlayers.map((p, rank) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      rank === 0
                        ? 'bg-amber-100/70 border border-amber-300 text-amber-900'
                        : 'bg-white text-slate-700 border border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center font-black">
                        {rank === 0 ? '👑 1위' : `${rank + 1}위`}
                      </span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span>{p.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{p.collectedCount}장</span>
                  </div>
                ))}
              </div>

              <button
                onClick={startNewGame}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} />
                새 게임 시작
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
