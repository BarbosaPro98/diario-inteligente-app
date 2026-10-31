"use client";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadPhoto } from "@/lib/vault";
import { cn } from "./ui";

/** Decifra uma foto em memória e devolve uma URL temporária (revogada ao desmontar). */
export function usePhotoUrl(key: CryptoKey, id: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    loadPhoto(key, id).then((bytes) => {
      if (!alive || !bytes) return;
      u = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
      setUrl(u);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [key, id]);
  return url;
}

export function Photo({ cryptoKey, id, className, onClick }: { cryptoKey: CryptoKey; id: string; className?: string; onClick?: () => void }) {
  const url = usePhotoUrl(cryptoKey, id);
  return (
    <button type="button" onClick={onClick} className={cn("relative overflow-hidden bg-surface-2", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <Loader2 className="absolute inset-0 m-auto animate-spin text-muted" size={18} />
      )}
    </button>
  );
}

export function PhotoAttach({
  cryptoKey,
  ids,
  remaining,
  onAdd,
  onRemove,
  readOnly,
}: {
  cryptoKey: CryptoKey;
  ids: string[];
  remaining: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {ids.map((id) => (
          <div key={id} className="relative aspect-square">
            <Photo cryptoKey={cryptoKey} id={id} className="h-full w-full rounded-ui" onClick={() => setZoom(id)} />
            {!readOnly && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Remover foto"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!readOnly && remaining > 0 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="bw flex aspect-square flex-col items-center justify-center gap-1 rounded-ui border border-dashed border-border text-xs text-muted hover:bg-surface-2"
          >
            <ImagePlus size={22} />
            Adicionar ({remaining})
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []).slice(0, remaining));
          e.target.value = "";
        }}
      />
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(null)}>
          <Photo cryptoKey={cryptoKey} id={zoom} className="max-h-full max-w-full bg-transparent [&_img]:object-contain" />
        </div>
      )}
    </div>
  );
}
