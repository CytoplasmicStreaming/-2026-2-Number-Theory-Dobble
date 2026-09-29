import { SYMBOLS, SymbolDef } from './symbols';

export interface CardItem {
  symbolId: number;
  symbol: SymbolDef;
  xPercent: number; // percentage offset from card center (-50 to +50)
  yPercent: number;
  scale: number;    // relative scale 0.75 to 1.35
  rotation: number; // rotation in degrees
}

export interface DobbleCard {
  id: number;
  symbolIds: number[];
  items: CardItem[];
}

/**
 * Standard Dobble: Generate 57 cards using PG(2, 7) of order q = 7.
 * Total points: 57, Total cards: 57, 8 symbols per card.
 * Any TWO cards intersect at EXACTLY ONE symbol.
 */
export function generateProjectivePlaneDeck(): DobbleCard[] {
  const q = 7;
  const rawCards: number[][] = [];

  // 1. Lines with finite slopes: y = (a*x + b) mod q (49 lines)
  for (let a = 0; a < q; a++) {
    for (let b = 0; b < q; b++) {
      const card: number[] = [];
      for (let x = 0; x < q; x++) {
        const y = (a * x + b) % q;
        card.push(x * q + y);
      }
      card.push(q * q + a);
      rawCards.push(card);
    }
  }

  // 2. Vertical lines: x = c mod q (7 lines)
  for (let c = 0; c < q; c++) {
    const card: number[] = [];
    for (let y = 0; y < q; y++) {
      card.push(c * q + y);
    }
    card.push(q * q + q);
    rawCards.push(card);
  }

  // 3. Line at infinity (1 line)
  const infCard: number[] = [];
  for (let a = 0; a < q; a++) {
    infCard.push(q * q + a);
  }
  infCard.push(q * q + q);
  rawCards.push(infCard);

  return rawCards.map((symbolIds, cardId) => {
    return createVisualCard8(cardId, symbolIds);
  });
}

/**
 * Variant Dobble: 8 cards with 7 symbols each from a 14-symbol pool.
 * Mathematical property: Any THREE distinct cards intersect at EXACTLY ONE symbol!
 *
 * Card 1: [2, 4, 6, 8, 10, 12, 14]
 * Card 2: [1, 4, 5, 8, 9, 12, 13]
 * Card 3: [1, 2, 3, 8, 9, 10, 11]
 * Card 4: [3, 5, 6, 8, 11, 13, 14]
 * Card 5: [1, 2, 3, 4, 5, 6, 7]
 * Card 6: [3, 4, 7, 9, 10, 13, 14]
 * Card 7: [2, 5, 7, 9, 11, 12, 14]
 * Card 8: [1, 6, 7, 10, 11, 12, 13]
 */
export function generateVariant3CardDeck(): DobbleCard[] {
  const rawDefinitions = [
    [2, 4, 6, 8, 10, 12, 14],
    [1, 4, 5, 8, 9, 12, 13],
    [1, 2, 3, 8, 9, 10, 11],
    [3, 5, 6, 8, 11, 13, 14],
    [1, 2, 3, 4, 5, 6, 7],
    [3, 4, 7, 9, 10, 13, 14],
    [2, 5, 7, 9, 11, 12, 14],
    [1, 6, 7, 10, 11, 12, 13],
  ];

  // Convert 1-based point numbers [1..14] to 0-based symbol IDs [0..13]
  const rawCards = rawDefinitions.map(card => card.map(p => p - 1));

  // Validate 3-card intersection property for all 56 triples
  validateVariantDeck(rawCards);

  return rawCards.map((symbolIds, cardId) => {
    return createVisualCard7(cardId, symbolIds);
  });
}

/**
 * Validates that all C(8, 3) = 56 triples of cards intersect at exactly 1 symbol.
 */
function validateVariantDeck(cards: number[][]): boolean {
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        const common = cards[i].filter(s => cards[j].includes(s) && cards[k].includes(s));
        if (common.length !== 1) {
          console.error(`Cards ${i}, ${j}, ${k} share ${common.length} symbols instead of 1!`);
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Finds the common symbol id between TWO cards (Standard Dobble).
 */
export function findCommonSymbol(cardA: DobbleCard, cardB: DobbleCard): number | null {
  for (const id of cardA.symbolIds) {
    if (cardB.symbolIds.includes(id)) {
      return id;
    }
  }
  return null;
}

/**
 * Finds the common symbol id among THREE cards (Variant Dobble).
 */
export function find3CardsCommonSymbol(
  cardA: DobbleCard,
  cardB: DobbleCard,
  cardC: DobbleCard
): number | null {
  for (const id of cardA.symbolIds) {
    if (cardB.symbolIds.includes(id) && cardC.symbolIds.includes(id)) {
      return id;
    }
  }
  return null;
}

// Pseudo-random deterministic generator for consistent visual appeal
function pseudoRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * 8-symbol card layout for Standard Dobble
 */
function createVisualCard8(cardId: number, symbolIds: number[]): DobbleCard {
  const shuffledSymbols = [...symbolIds];
  for (let i = shuffledSymbols.length - 1; i > 0; i--) {
    const rnd = pseudoRandom(cardId * 100 + i);
    const j = Math.floor(rnd * (i + 1));
    [shuffledSymbols[i], shuffledSymbols[j]] = [shuffledSymbols[j], shuffledSymbols[i]];
  }

  const scales = [1.25, 0.85, 1.15, 0.95, 1.2, 0.9, 1.1, 0.95];
  
  const items: CardItem[] = shuffledSymbols.map((symId, idx) => {
    let radiusPercent: number;
    let angleRad: number;
    const rndScale = pseudoRandom(cardId * 20 + idx * 7);
    const rndRot = pseudoRandom(cardId * 50 + idx * 11);

    if (idx === 0) {
      // Central symbol: placed exactly in the center of the card
      radiusPercent = 0;
      angleRad = 0;
    } else {
      // 7 perimeter symbols: evenly spaced around the center
      const baseAngle = ((idx - 1) / 7) * Math.PI * 2;
      const angleJitter = (rndRot - 0.5) * 0.15;
      angleRad = baseAngle + angleJitter;
      radiusPercent = 29 + (rndScale * 4);
    }

    const xPercent = Math.round(Math.cos(angleRad) * radiusPercent * 10) / 10;
    const yPercent = Math.round(Math.sin(angleRad) * radiusPercent * 10) / 10;
    const scale = scales[idx] * (0.95 + rndScale * 0.12);
    const rotation = Math.round((rndRot - 0.5) * 50);

    const symbolDef = SYMBOLS.find(s => s.id === symId) || SYMBOLS[0];

    return {
      symbolId: symId,
      symbol: symbolDef,
      xPercent,
      yPercent,
      scale,
      rotation,
    };
  });

  return {
    id: cardId,
    symbolIds,
    items,
  };
}

/**
 * 7-symbol card layout for Variant Dobble
 */
function createVisualCard7(cardId: number, symbolIds: number[]): DobbleCard {
  const shuffledSymbols = [...symbolIds];
  for (let i = shuffledSymbols.length - 1; i > 0; i--) {
    const rnd = pseudoRandom(cardId * 100 + i);
    const j = Math.floor(rnd * (i + 1));
    [shuffledSymbols[i], shuffledSymbols[j]] = [shuffledSymbols[j], shuffledSymbols[i]];
  }

  const scales = [1.2, 0.95, 1.1, 1.0, 1.15, 0.95, 1.05];

  const items: CardItem[] = shuffledSymbols.map((symId, idx) => {
    let radiusPercent: number;
    let angleRad: number;
    const rndScale = pseudoRandom(cardId * 30 + idx * 7);
    const rndRot = pseudoRandom(cardId * 70 + idx * 13);

    if (idx === 0) {
      // Central symbol: exactly in center
      radiusPercent = 0;
      angleRad = 0;
    } else {
      // 6 perimeter symbols: evenly spaced around the center
      const baseAngle = ((idx - 1) / 6) * Math.PI * 2;
      const angleJitter = (rndRot - 0.5) * 0.15;
      angleRad = baseAngle + angleJitter;
      radiusPercent = 29 + (rndScale * 4);
    }

    const xPercent = Math.round(Math.cos(angleRad) * radiusPercent * 10) / 10;
    const yPercent = Math.round(Math.sin(angleRad) * radiusPercent * 10) / 10;
    const scale = scales[idx] * (0.95 + rndScale * 0.12);
    const rotation = Math.round((rndRot - 0.5) * 50);

    const symbolDef = SYMBOLS.find(s => s.id === symId) || SYMBOLS[0];

    return {
      symbolId: symId,
      symbol: symbolDef,
      xPercent,
      yPercent,
      scale,
      rotation,
    };
  });

  return {
    id: cardId,
    symbolIds,
    items,
  };
}

/**
 * Fisher-Yates shuffle with true randomness
 */
export function shuffleCards(deck: DobbleCard[]): DobbleCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
