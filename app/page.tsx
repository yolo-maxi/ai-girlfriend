'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
};

const MAX_NUDGES = 1;

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
    title: 'Barrier broken',
    copy: 'Reward scene unlocked. She is trying and failing to be normal.',
    icon: '💌',
    className: 'vault-open',
  },
];

function vaultTier(meter: number) {
  return [...VAULT_TIERS].reverse().find((tier) => meter >= tier.min) || VAULT_TIERS[0];
}

function pickOpener(waifu: (typeof WAIFUS)[number]) {
  const pool = [...BASE_OPENERS, ...(CHARACTER_OPENERS[waifu.id] || [])];
  return pool[Math.floor(Math.random() * pool.length)];
}

// One catalogue card with graceful image fallback to an emoji face.
function CatalogueCard({ waifu, onPick }: { waifu: (typeof WAIFUS)[number]; onPick: () => void }) {
  const [ok, setOk] = useState(true);
  return (
    <button className="cat-card" onClick={onPick} style={{ ['--accent' as any]: waifu.accent }}>
      <div className="cat-portrait">
        {ok ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/waifu/${waifu.id}/happy.png`} alt={waifu.name} onError={() => setOk(false)} />
        ) : (
          <span className="cat-emoji">💕</span>
        )}
      </div>
      <div className="cat-meta">
        <strong>{waifu.name}</strong>
        <span>{waifu.tagline}</span>
      </div>
    </button>
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

  const logRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeIdx = useRef(0);
  const nudgeCount = useRef(0); // consecutive unprompted nudges since last user reply

  const waifu = getWaifu(waifuId);
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
    const reward = `${waifu.name}'s last barrier broke 💌 reward unlocked: she admits your rizz worked and gets 20% more insufferably attached.`;
    setVaultUnlocked(true);
    setRewardOpen(true);
    setEmotion('excited');
    setLog((l) => [...l, { who: 'her', text: reward }]);
    setHistory((h) => [...h, { role: 'assistant', content: reward }]);
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
      setLog((l) => [...l, { who: 'her', text: "nooo my brain glitched 🥺 say it again?" }]);
    } finally {
      setBusy(false);
      armNudge();
      scrollDown();
    }
  }

  // --- Catalogue screen: pick one waifu, then chat ---
  if (!waifuId) {
    return (
      <div className="catalogue">
        <header className="cat-head">
          <h1>pick your girlfriend 💕</h1>
          <p>choose one. then try to rizz past her defenses.</p>
        </header>
        <div className="cat-grid">
          {WAIFUS.map((w) => (
            <CatalogueCard key={w.id} waifu={w} onPick={() => setWaifuId(w.id)} />
          ))}
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
            💌 rizz reward unlocked
          </button>
        )}

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
            <p className="reward-kicker">rizz barrier</p>
            <h2 id="reward-title">Unlocked with {waifu.name}</h2>
            <p>
              She tries to play it cool, fails instantly, and writes your name in a tiny heart
              before pretending that definitely did not happen.
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
