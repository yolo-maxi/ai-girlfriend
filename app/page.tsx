'use client';

import { useEffect, useRef, useState, useCallback, type CSSProperties, type PointerEvent } from 'react';
import { WAIFUS, getWaifu, Emotion } from '@/lib/waifus';
import { NUDGES } from '@/lib/personality';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const EMOTION_EMOJI: Record<string, string> = {
  neutral: '😶', happy: '😊', excited: '🤩', blush: '😳', sad: '🥺',
  angry: '😤', jealous: '😒', surprised: '😮', pleading: '🥹', smug: '😏',
  sexy: '😍', playful_kiss: '😘',
};

const BASE_OPENERS = [
  "you made it. I was two seconds away from inventing drama without you. what's the actual vibe today?",
  "okay, status check: are we in cozy mode, chaos mode, or tiny crisis mode?",
  "hi hi. I saved you the good seat and an unreasonable amount of attention. what are we dealing with?",
  "there you are. tell me one thing from your day and I'll decide whether we're being supportive or judgmental.",
  "welcome back. I have snacks, opinions, and exactly zero chill. how's your day going?",
  "quick mood scan: tired, smug, emotionally suspicious, or quietly thriving?",
  "I was behaving for almost a full minute. anyway, what happened today?",
  "hey. give me the headline version of your day and I'll ask the follow-up questions like a professional menace.",
];

const CHARACTER_OPENERS: Record<string, string[]> = {
  yumi: [
    "you came back!! I was absolutely normal about waiting. extremely casual. so what did I miss?",
    "okay, sit with me. did today need comfort, encouragement, or a tiny bit of revenge planning?",
  ],
  rei: [
    "you're here. good. I was starting to overanalyze the silence. what are we investigating today?",
    "hmm. your timing is suspiciously interesting. what's on your mind?",
  ],
  akari: [
    "YES, finally. pick a lane: chaos recap, bad idea review, or snack-based emotional support?",
    "I have energy and questionable judgment. what are we doing with that?",
  ],
  momo: [
    "bestie report in. are we celebrating, spiraling, or pretending everything is totally fine?",
    "okay babe, today's menu is attention, opinions, and maybe consequences. what's the headline?",
  ],
  nova: [
    "connection established. emotional firewall status: probably terrible. what's the signal?",
    "I'm online and pretending not to scan for drama. what thread are we pulling?",
  ],
  mei: [
    "welcome home, nya. did the outside world behave, or do I need to judge it for you?",
    "I made myself useful by waiting cutely. what should I be nosy about first?",
  ],
  shizuku: [
    "you kept a lady waiting. charmingly rude. what excuse are you offering me?",
    "there you are. tell me whether today's drama deserves sympathy, judgment, or a dramatic sigh.",
  ],
  hina: [
    "mmm. you're here. I was almost productive, which would have been tragic. what happened?",
    "I brought blanket energy and one functioning brain cell. what are we using it for?",
  ],
};

const MAX_NUDGES = 1;
const SWIPE_ANIM_MS = 220;
const SWIPE_COOLDOWN_MS = 520;

const SILLY_QUOTES: Record<string, string> = {
  yumi: '"I packed snacks for our fake emergency."',
  rei: '"I know three facts and two are classified."',
  akari: '"Bad ideas are just ideas with cardio."',
  momo: '"If drama paid rent I would own a duplex."',
  nova: '"Emotionally unavailable, but with good uptime."',
  mei: '"I did not knock that glass over. gravity did."',
  shizuku: '"My parasol is for shade and emotional distance."',
  hina: '"Emotionally available after a 14-hour nap."',
};

const RIZZ_EXAMPLES = [
  "I picked you because that smile looks like trouble.",
  "You can pretend you're hard to impress, but I saw that blush.",
  "Tell me what would make you smile for real.",
  "I'm not here to win fast. I'm here to make you forget the game.",
];

const VAULT_TIERS = [
  {
    min: 0,
    title: 'Guard up',
    copy: 'Charm her without trying too hard.',
    icon: '🛡️',
    className: 'vault-low',
  },
  {
    min: 30,
    title: 'Curious',
    copy: 'The teasing is starting to work.',
    icon: '👀',
    className: 'vault-mid',
  },
  {
    min: 70,
    title: 'Flustered',
    copy: 'Her defenses are getting wobbly.',
    icon: '💗',
    className: 'vault-high',
  },
  {
    min: 100,
    title: 'Won over',
    copy: 'Final barrier broken. Kiss scene unlocked.',
    icon: '💋',
    className: 'vault-open',
  },
];

function vaultTier(meter: number) {
  return [...VAULT_TIERS].reverse().find((tier) => meter >= tier.min) || VAULT_TIERS[0];
}

type Waifu = (typeof WAIFUS)[number];
type ExitingCard = {
  index: number;
  dir: 'left' | 'right';
  dragX: number;
};

function pickOpener(waifu: Waifu) {
  const pool = [...BASE_OPENERS, ...(CHARACTER_OPENERS[waifu.id] || [])];
  return pool[Math.floor(Math.random() * pool.length)];
}

function SwipeCard({
  waifu,
  className = '',
  style,
  interactive = false,
  showPick,
  showPass,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  waifu: Waifu;
  className?: string;
  style?: CSSProperties;
  interactive?: boolean;
  showPick?: boolean;
  showPass?: boolean;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: () => void;
}) {
  return (
    <div
      className={`swipe-card ${className} ${showPick ? 'show-pick' : ''} ${showPass ? 'show-pass' : ''}`}
      style={{ ...style, ['--card-accent' as any]: waifu.accent }}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerCancel={interactive ? onPointerCancel : undefined}
    >
      {interactive && (
        <>
          <span className="swipe-stamp pick">rizz</span>
          <span className="swipe-stamp pass">next</span>
        </>
      )}
      <div className="swipe-portrait">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/waifu/${waifu.id}/happy.png`} alt={waifu.name} />
      </div>
      <div className="swipe-meta">
        <h2>{waifu.name}</h2>
        <p>{waifu.tagline}</p>
        <p className="swipe-quote">{SILLY_QUOTES[waifu.id]}</p>
      </div>
    </div>
  );
}

export default function Page() {
  // null until the user picks a waifu from the catalogue
  const [waifuId, setWaifuId] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<Emotion>('happy');
  const [meter, setMeter] = useState(0);
  const [log, setLog] = useState<{ who: 'her' | 'me'; text: string }[]>([]);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [deckIndex, setDeckIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [exitingCard, setExitingCard] = useState<ExitingCard | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeIdx = useRef(0);
  const nudgeCount = useRef(0); // consecutive unprompted nudges since last user reply
  const dragStartX = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const deckLockedUntil = useRef(0);

  const waifu = getWaifu(waifuId);
  const deckWaifu = WAIFUS[deckIndex % WAIFUS.length];
  const nextDeckWaifu = WAIFUS[(deckIndex + 1) % WAIFUS.length];
  const deckBusy = !!exitingCard;
  const imgSrc = `/waifu/${waifu.id}/${emotion}.png`;
  const tier = vaultTier(meter);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }, []);

  // --- unprompted prodding: she nudges when you go quiet, capped at MAX_NUDGES ---
  const armNudge = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (nudgeCount.current >= MAX_NUDGES) return; // cap: don't pester past 3
    idleTimer.current = setTimeout(() => {
      const n = NUDGES[nudgeIdx.current % NUDGES.length];
      nudgeIdx.current += 1;
      nudgeCount.current += 1;
      setEmotion(n.emotion as Emotion);
      setLog((l) => [...l, { who: 'her', text: n.say }]);
      setHistory((h) => [...h, { role: 'assistant', content: n.say }]);
      scrollDown();
      armNudge(); // keep prodding until the cap
    }, 22000 + Math.random() * 12000);
  }, [scrollDown]);

  // greet + start prodding once a waifu is chosen
  useEffect(() => {
    if (!waifuId) return;
    const opener = pickOpener(waifu);
    setLog([{ who: 'her', text: opener }]);
    setHistory([{ role: 'assistant', content: opener }]);
    setEmotion('excited');
    setMeter(0);
    setVaultUnlocked(false);
    setRewardOpen(false);
    setImgOk(true);
    nudgeCount.current = 0;
    nudgeIdx.current = 0;
    armNudge();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waifuId]);

  useEffect(scrollDown, [log, scrollDown]);

  // set CSS accent per waifu
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', waifu.accent);
  }, [waifu.accent]);

  useEffect(() => {
    setImgOk(true);
  }, [imgSrc]);

  function setDeckDrag(x: number) {
    dragXRef.current = x;
    setDragX(x);
  }

  function beginDeckAction() {
    const now = Date.now();
    if (deckBusy || now < deckLockedUntil.current) return false;
    deckLockedUntil.current = now + SWIPE_COOLDOWN_MS;
    return true;
  }

  function passCard() {
    if (!beginDeckAction()) return;
    const currentIndex = deckIndex;
    const exitX = dragXRef.current;
    setExitingCard({ index: currentIndex, dir: 'left', dragX: exitX });
    setDeckIndex((i) => (i + 1) % WAIFUS.length);
    setDeckDrag(0);
    window.setTimeout(() => {
      setExitingCard(null);
    }, SWIPE_ANIM_MS);
  }

  function pickCard() {
    if (!beginDeckAction()) return;
    const currentIndex = deckIndex;
    const pickedWaifu = deckWaifu;
    const exitX = dragXRef.current;
    setExitingCard({ index: currentIndex, dir: 'right', dragX: exitX });
    setDeckIndex((i) => (i + 1) % WAIFUS.length);
    setDeckDrag(0);
    window.setTimeout(() => {
      setWaifuId(pickedWaifu.id);
      setExitingCard(null);
    }, SWIPE_ANIM_MS);
  }

  function onCardPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (deckBusy || Date.now() < deckLockedUntil.current) return;
    e.preventDefault();
    e.stopPropagation();
    dragStartX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onCardPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragStartX.current == null || deckBusy) return;
    e.preventDefault();
    e.stopPropagation();
    const nextX = Math.max(-140, Math.min(140, e.clientX - dragStartX.current));
    setDeckDrag(nextX);
  }

  function onCardPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragStartX.current == null) return;
    e.preventDefault();
    e.stopPropagation();
    dragStartX.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const finalX = dragXRef.current;
    if (finalX > 86) pickCard();
    else if (finalX < -86) passCard();
    else setDeckDrag(0);
  }

  function backToCatalogue() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setWaifuId(null);
    setLog([]);
    setHistory([]);
    setInput('');
    setMeter(0);
    setVaultUnlocked(false);
    setRewardOpen(false);
  }

  function unlockVault() {
    if (vaultUnlocked) return;
    const reward = `${waifu.name}'s last barrier broke 💋 kiss scene unlocked: she stops pretending your rizz isn't working.`;
    setVaultUnlocked(true);
    setRewardOpen(true);
    setEmotion('sexy');
    setLog((l) => [...l, { who: 'her', text: reward }]);
    setHistory((h) => [...h, { role: 'assistant', content: reward }]);
  }

  function useExample(text: string) {
    setInput(text);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setLog((l) => [...l, { who: 'me', text }]);
    const nextHist: ChatMsg[] = [...history, { role: 'user', content: text }];
    setHistory(nextHist);
    setBusy(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    nudgeCount.current = 0; // user replied → she's allowed to prod again
    scrollDown();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waifuId, messages: nextHist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'error');
      const say: string = data.say;
      const nextMeter = Math.max(meter, data.secretMeter || 0);
      setEmotion((data.emotion as Emotion) || 'happy');
      setMeter(nextMeter);
      setLog((l) => [...l, { who: 'her', text: say }]);
      setHistory((h) => [...h, { role: 'assistant', content: say }]);
      if (nextMeter >= 100) unlockVault();
    } catch (e) {
      setEmotion('sad');
      setLog((l) => [...l, { who: 'her', text: "my signal tripped over its own shoelaces. send that again?" }]);
    } finally {
      setBusy(false);
      armNudge();
      scrollDown();
    }
  }

  // --- Catalogue screen: pick one waifu, then chat ---
  if (!waifuId) {
    const frontTransform = `translateX(${dragX}px) rotate(${dragX / 18}deg)`;
    const exitingWaifu = exitingCard ? WAIFUS[exitingCard.index % WAIFUS.length] : null;
    const exitingTransform = exitingCard?.dir === 'right'
      ? `translateX(115vw) rotate(${Math.max(16, exitingCard.dragX / 12)}deg)`
      : `translateX(-115vw) rotate(${Math.min(-16, exitingCard ? exitingCard.dragX / 12 : -16)}deg)`;

    return (
      <div className="catalogue" style={{ ['--accent' as any]: deckWaifu.accent }}>
        <header className="cat-head">
          <h1>pick your girlfriend 💕</h1>
          <p>find the one whose defenses you want to ruin.</p>
        </header>

        <div className="swipe-shell">
          <div className="swipe-stack">
            {!exitingCard && (
              <SwipeCard
                key={`back-${(deckIndex + 1) % WAIFUS.length}`}
                waifu={nextDeckWaifu}
                className="swipe-card-back"
              />
            )}
            <SwipeCard
              key={`front-${deckIndex % WAIFUS.length}`}
              waifu={deckWaifu}
              className={exitingCard ? 'swipe-card-ready' : 'swipe-card-front'}
              style={{ transform: exitingCard ? undefined : frontTransform }}
              interactive={!exitingCard}
              showPick={dragX > 35}
              showPass={dragX < -35}
              onPointerDown={onCardPointerDown}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              onPointerCancel={() => {
                dragStartX.current = null;
                setDeckDrag(0);
              }}
            />
            {exitingCard && exitingWaifu && (
              <SwipeCard
                key={`front-${exitingCard.index % WAIFUS.length}`}
                waifu={exitingWaifu}
                className={`swipe-card-front swipe-card-exiting is-${exitingCard.dir}`}
                style={{ transform: exitingTransform }}
                showPick={exitingCard.dir === 'right'}
                showPass={exitingCard.dir === 'left'}
              />
            )}
          </div>

          <div className="swipe-actions">
            <button className="swipe-action pass" onClick={passCard} disabled={deckBusy} title="pass" aria-label="pass">×</button>
            <button className="swipe-action pick" onClick={pickCard} disabled={deckBusy} title="pick" aria-label="pick">♥</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Chat screen (no in-chat switcher) ---
  return (
    <div className="app">
      <section className="stage">
        <button className="back-btn" onClick={backToCatalogue} title="pick someone else">← catalogue</button>
        <div className={`meter ${tier.className} ${vaultUnlocked ? 'is-unlocked' : ''}`}>
          <div className="label">
            <span>{tier.icon} {tier.title}</span>
            <span>{meter}%</span>
          </div>
          <div className="bar"><div className="fill" style={{ width: `${meter}%` }} /></div>
          <div className="meter-copy">{tier.copy}</div>
        </div>

        {vaultUnlocked && (
          <button className="vault-keepsake" onClick={() => setRewardOpen(true)}>
            💋 kiss scene unlocked
          </button>
        )}

        <aside className="rizz-guide" aria-label="How to play">
          <p className="rizz-kicker">how to play</p>
          <h2>Rizz her up</h2>
          <p>Be specific, tease lightly, or ask something that sounds like you actually noticed her.</p>
          <div className="rizz-examples">
            {RIZZ_EXAMPLES.map((example) => (
              <button key={example} onClick={() => useExample(example)}>
                {example}
              </button>
            ))}
          </div>
        </aside>

        <div className="waifu-wrap">
          {imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={imgSrc}
              className="waifu-img"
              src={imgSrc}
              alt={`${waifu.name} feeling ${emotion}`}
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="waifu-img placeholder" title="image not generated yet">
              {EMOTION_EMOJI[emotion] || '💕'}
            </div>
          )}
        </div>

        <div className="namecard">
          <h1>{waifu.name}</h1>
          <p>{waifu.tagline}</p>
          <span className="emotion-chip">{EMOTION_EMOJI[emotion]} {emotion}</span>
        </div>
      </section>

      {rewardOpen && (
        <div className="reward" role="dialog" aria-modal="true" aria-labelledby="reward-title">
          <div className="reward-burst" aria-hidden="true">
            <span>✦</span><span>♡</span><span>✧</span><span>💌</span><span>✦</span>
          </div>
          <div className="reward-panel">
            <p className="reward-kicker">won over</p>
            <h2 id="reward-title">Kiss scene with {waifu.name}</h2>
            <div className="reward-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/waifu/${waifu.id}/playful_kiss.png`} alt={`${waifu.name} kiss reward`} />
            </div>
            <p>
              She tries to play it cool, fails instantly, and lets the flirty version of her
              take over for the rest of the chat.
            </p>
            <button onClick={() => setRewardOpen(false)}>keep chatting</button>
          </div>
        </div>
      )}

      <section className="chat">
        <div className="log" ref={logRef}>
          {log.map((m, i) => (
            <div key={i} className={`msg ${m.who}`}>{m.text}</div>
          ))}
          {busy && (
            <div className="msg her typing dots">
              typing<span>.</span><span>.</span><span>.</span>
            </div>
          )}
        </div>

        <div className="composer">
          <input
            ref={inputRef}
            value={input}
            placeholder="say something charming..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={busy}
          />
          <button onClick={send} disabled={busy || !input.trim()}>send 💌</button>
        </div>
      </section>
    </div>
  );
}
