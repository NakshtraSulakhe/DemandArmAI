'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function CallAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[rgba(10,15,29,0.65)] px-3 py-2.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-[0_0_0_4px_rgba(99,102,241,0.18)]"
          aria-label={playing ? 'Pause recording' : 'Play recording'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(current, duration || 0)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = next;
              setCurrent(next);
            }}
            className="w-full accent-indigo-400"
            aria-label="Recording position"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] font-medium tabular-nums text-slate-400">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {[1, 1.25, 1.5, 2].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setRate(value);
              if (audioRef.current) audioRef.current.playbackRate = value;
            }}
            className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
              rate === value ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {value}x
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-slate-400">
          <Volume2 className="h-3.5 w-3.5" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              if (audioRef.current) audioRef.current.volume = next;
            }}
            className="w-16 accent-sky-400"
            aria-label="Volume"
          />
        </label>
      </div>
    </div>
  );
}
