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

export default function Page() {
  const [waifuId, setWaifuId] = useState(WAIFUS[0].id);
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

  const waifu = getWaifu(waifuId);
  const imgSrc = `/waifu/${waifu.id}/${emotion}.png`;

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }, []);

  // --- unprompted prodding: she nudges when you go quiet, no waiting for replies ---
  const armNudge = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      const n = NUDGES[nudgeIdx.current % NUDGES.length];
      nudgeIdx.current += 1;
      setEmotion(n.emotion as Emotion);
      setLog((l) => [...l, { who: 'her', text: n.say }]);
      setHistory((h) => [...h, { role: 'assistant', content: n.say }]);
      scrollDown();
      armNudge(); // keep prodding
    }, 7000 + Math.random() * 4000);
  }, [scrollDown]);

  // greet + start prodding on load / waifu switch
  useEffect(() => {
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
    setLog([{ who: 'her', text: opener }]);
    setHistory([{ role: 'assistant', content: opener }]);
    setEmotion('excited');
    setMeter(0);
    setImgOk(true);
    armNudge();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waifuId]);

  useEffect(scrollDown, [log, scrollDown]);

  // set CSS accent per waifu
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', waifu.accent);
  }, [waifu.accent]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setLog((l) => [...l, { who: 'me', text }]);
    const nextHist: ChatMsg[] = [...history, { role: 'user', content: text }];
    setHistory(nextHist);
    setBusy(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
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

  return (
    <div className="app">
      <section className="stage">
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
        <div className="picker">
          {WAIFUS.map((w) => (
            <button
              key={w.id}
              className={w.id === waifuId ? 'active' : ''}
              onClick={() => w.id !== waifuId && setWaifuId(w.id)}
            >
              {w.name}
            </button>
          ))}
        </div>

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
