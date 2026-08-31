/* Ilustrações — traço único ~2px, cor currentColor (herda --ink), preenchimento só nos acentos. */

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M4 25c4-1 7-1 12 0s10 1 12 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 25V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 8c3 .2 5 1.6 8 1.2-1.6 2-1.6 3.4 0 5.4-3 .4-5-1-8-1.2" fill="var(--color-clay)" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`display text-[1.15rem] leading-none ${className}`} style={{ fontWeight: 600 }}>
      Aristótel
      <span className="relative">
        .IA
        <span
          className="absolute -top-[3px] left-[3px] block h-[3px] w-[3px] rounded-full"
          style={{ background: "var(--color-clay)" }}
        />
      </span>
    </span>
  );
}

/** Tomate-cronômetro: a fatia escura varre no sentido horário conforme o foco passa. */
export function Tomato({ progress = 0, size = 260 }: { progress?: number; size?: number }) {
  const p = Math.max(0, Math.min(0.9999, progress));
  const CX = 100;
  const CY = 108;
  const R = 60;
  const a = p * 2 * Math.PI;
  const ex = CX + R * Math.sin(a);
  const ey = CY - R * Math.cos(a);
  const large = p > 0.5 ? 1 : 0;
  const wedge =
    p <= 0 ? "" : `M ${CX} ${CY} L ${CX} ${CY - R} A ${R} ${R} 0 ${large} 1 ${ex} ${ey} Z`;

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden>
      <defs>
        <clipPath id="tomatoBody">
          <path d="M100 48c36 0 62 26 62 60 0 34-28 56-62 56S38 142 38 108c0-34 26-60 62-60Z" />
        </clipPath>
      </defs>

      {/* corpo vermelho */}
      <path
        d="M100 48c36 0 62 26 62 60 0 34-28 56-62 56S38 142 38 108c0-34 26-60 62-60Z"
        fill="var(--color-clay)"
      />
      {/* fatia decorrida */}
      {wedge && (
        <g clipPath="url(#tomatoBody)">
          <path d={wedge} fill="color-mix(in srgb, var(--color-clay) 60%, #2b2621)" />
        </g>
      )}
      {/* contorno + gomos */}
      <g clipPath="url(#tomatoBody)">
        <path d="M100 48v120M62 60c-6 20-6 40 0 60M138 60c6 20 6 40 0 60" stroke="color-mix(in srgb, var(--color-clay) 55%, #2b2621)" strokeWidth="2" opacity="0.4" />
      </g>
      <path
        d="M100 48c36 0 62 26 62 60 0 34-28 56-62 56S38 142 38 108c0-34 26-60 62-60Z"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      {/* brilho */}
      <path d="M72 92c5-10 15-16 26-15" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.35" />

      {/* folhas verdes */}
      <path
        d="M100 48c-3-11-10-17-20-19 5 6 5 11 2 16-7-8-16-9-25-6 8 4 11 9 12 16 8-4 15-5 23-4l8-3 8 3c8-1 15 0 23 4 1-7 4-12 12-16-9-3-18-2-25 6-3-5-3-10 2-16-10 2-17 8-20 19Z"
        fill="var(--color-growth)"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M100 30v12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Spot pequeno pra estado vazio: uma pedra no caminho. */
export function EmptyStone({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden>
      <path d="M8 56c6-2 12-2 20-1s18 1 28 0 14-2 16 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path
        d="M28 52c-6 0-11-4-11-10s6-11 14-11 15 4 15 11-4 10-10 10Z"
        fill="var(--color-paper-2)"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
