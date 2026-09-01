# Aristótel.IA — landing page

App Next.js **standalone**, separado do painel (`../web`). Feito pra rodar na **Vercel**.

## Rodar local

```bash
cd landing
npm install
cp .env.example .env.local   # opcional — sem chave o widget mostra um exemplo
npm run dev                   # http://localhost:3001
```

## O que tem

- `/` — a landing (tema claro por padrão, toggle no topo, estátua no hero).
- `/privacidade` — política de privacidade (URL exigida pela tela de consentimento do Google no fluxo de agenda do painel).
- `/api/trilha/preview` — recebe `{ goal }`, gera a **semana 1** da trilha com o LLM (cadeia Groq → Gemini), devolve os 5 dias. O front mostra os 2 primeiros e borra o resto, com CTA pro Telegram.
  - Rate limit em memória: 6 req/hora por IP (na Vercel é por instância — trocar por Upstash se o tráfego crescer).
  - Cache por objetivo normalizado (24h) — mata o custo de repetição.
  - Sem `GROQ_API_KEY`/`GEMINI_API_KEY` → responde 503 e o front mostra um exemplo estático + CTA.

## Deploy na Vercel

1. New Project → importar este repositório.
2. **Root Directory: `landing`**.
3. Framework: Next.js (detecta sozinho). Build/Output: padrão.
4. Environment Variables:
   | var | valor |
   |---|---|
   | `GROQ_API_KEY` | chave grátis do console.groq.com |
   | `GEMINI_API_KEY` | chave grátis do aistudio.google.com (opcional, é o fallback) |
   | `LLM_MODEL` | `openai/gpt-oss-120b` (padrão) |
   | `NEXT_PUBLIC_BOT` | `AristotelIA_bot` (só se o handle mudar) |
5. Deploy. Depois, em Settings → Domains, apontar o domínio final e atualizar `SITE` em `src/app/layout.tsx`.

## Manutenção

- A cadeia de LLM espelha `../web/src/lib/coach-llm.ts` (sem banco/telemetria). Se lá mudar de provedor, alinhar `src/lib/llm.ts`.
- A geração da trilha aqui é um **teaser** — não é a mesma da trilha real (que roda no bot, `../bot/prompts.py`). É de propósito: aqui é 1 chamada barata, sem nível/tempo, só pra pessoa sentir o gosto.
- Fonte de design: `../docs/landing/index.html` (mockup original) + tokens de `../web/src/app/globals.css`.
