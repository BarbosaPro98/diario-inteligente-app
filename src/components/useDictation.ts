"use client";
// Ditado por voz com a Web Speech API (SpeechRecognition), em português.
import { useCallback, useEffect, useRef, useState } from "react";

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSR(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type DictationState = "idle" | "recording" | "paused";

/**
 * onFinal recebe cada trecho finalizado; `interim` mostra o texto ainda em reconhecimento.
 * `session` acumula o que foi ditado desde o último "limpar", para permitir desfazer.
 */
export function useDictation(onFinal: (text: string) => void, onError?: (msg: string) => void) {
  const [state, setState] = useState<DictationState>("idle");
  const [interim, setInterim] = useState("");
  const [session, setSession] = useState("");
  const recRef = useRef<SR | null>(null);
  const wantRef = useRef(false);
  const cb = useRef(onFinal);
  const errCb = useRef(onError);
  useEffect(() => {
    cb.current = onFinal;
    errCb.current = onError;
  });

  const supported = typeof window !== "undefined" && !!getSR();

  const begin = useCallback(() => {
    const Ctor = getSR();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) {
          cb.current(t.trim());
          setSession((s) => (s ? s + " " : "") + t.trim());
        } else live += t;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantRef.current = false;
      errCb.current?.(e.error === "not-allowed" ? "Permissão de microfone negada" : `Erro no ditado: ${e.error}`);
    };
    rec.onend = () => {
      setInterim("");
      // O navegador encerra sozinho após silêncio; reinicia enquanto o usuário quiser gravar.
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          setState("idle");
        }
      }
    };
    recRef.current = rec;
    wantRef.current = true;
    rec.start();
    setState("recording");
  }, []);

  const start = useCallback(() => {
    setSession("");
    begin();
  }, [begin]);

  const pause = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setState("paused");
  }, []);

  const resume = useCallback(() => begin(), [begin]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setState("idle");
  }, []);

  const clear = useCallback(() => {
    setSession("");
    setInterim("");
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.abort();
    },
    [],
  );

  return { supported, state, interim, session, start, pause, resume, stop, clear };
}
