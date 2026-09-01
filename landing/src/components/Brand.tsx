export function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Aristótel.IA — início">
      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 24.5c3.5-1 6-1 10 0s8.5 1 10 0" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M13 24.5V6.5" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
        <path className="flag" d="M13 7c3.4.3 5.8 1.9 9.4 1.4-1.9 2.4-1.9 4 0 6.4-3.6.5-6-1.1-9.4-1.4Z" fill="var(--clay)" />
      </svg>
      <span>
        Aristótel<span className="dot">.</span>IA
      </span>
    </a>
  );
}
