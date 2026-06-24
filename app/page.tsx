'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WAIFUS, getWaifu, Emotion } from '@/lib/waifus';
import { NUDGES } from '@/lib/personality';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const EMOTION_EMOJI: Record<string, string> = {
  neutral: '😶', happy: '😊', excited: '🤩', blush: '😳', sad: '🥺',
  angry: '😤', jealous: '😒', surprised: '😮', pleading: '🥹', smug: '😏',
};

const OPENERS = [
  "hiii~ you're finally here 💕 ok ok serious question: what's a secret you've NEVER told anyone? 👀",
  "omg hi!! 🥰 don't worry don't worry, you can tell me anything, I'm basically a vault~ so... darkest secret. go.",
  "ehehe welcome 😈 I PROMISE I won't tell a soul. now confess something juicy, I'm dying to know~",
];

const MAX_NUDGES = 3;

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

  const logRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeIdx = useRef(0);
  const nudgeCount = useRef(0); // consecutive unprompted nudges since last user reply

  const waifu = getWaifu(waifuId);
  const imgSrc = `/waifu/${waifu.id}/${emotion}.png`;

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
    }, 7000 + Math.random() * 4000);
  }, [scrollDown]);

  // greet + start prodding once a waifu is chosen
  useEffect(() => {
    if (!waifuId) return;
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
    setLog([{ who: 'her', text: opener }]);
    setHistory([{ role: 'assistant', content: opener }]);
    setEmotion('excited');
    setMeter(0);
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

  function backToCatalogue() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setWaifuId(null);
    setLog([]);
    setHistory([]);
    setInput('');
    setMeter(0);
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
      setEmotion((data.emotion as Emotion) || 'happy');
      setMeter((m) => Math.max(m, data.secretMeter || 0));
      setLog((l) => [...l, { who: 'her', text: say }]);
      setHistory((h) => [...h, { role: 'assistant', content: say }]);
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
          <p>choose one. she&apos;s been waiting. (she keeps secrets~ 😇)</p>
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
        <div className="meter">
          <div className="label">
            <span>🔓 secret meter</span>
            <span>{meter}%</span>
          </div>
          <div className="bar"><div className="fill" style={{ width: `${meter}%` }} /></div>
        </div>

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
            placeholder="tell her something... (she swears she won't tell)"
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
