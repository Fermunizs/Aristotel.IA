# Aristótel.IA 🤖

Treinadora pessoal de alta performance no Telegram — o "agente de evolução 1%".
Todo dia ela diz **o que estudar**, faz **você pensar**, faz **você aplicar**, **registra** e transforma seu aprendizado em **conteúdo**.

Bot: [t.me/AristotelIA_bot](https://t.me/AristotelIA_bot)

> 📖 Documentação completa em [`Claude.md`](Claude.md). Histórico em [`Memória.md`](Memória.md). Tom de voz em [`Design.md`](Design.md).

## Rotina

| 06:00 | 08:00 | 09:00 | 10:30 | 15:00 | 16:00 | 20:00 |
|---|---|---|---|---|---|---|
| motivação | o que estudar | pílula | quiz | insight | desafio | fechamento 1% |

Domingo: revisão da semana + ideias de conteúdo + próxima semana da trilha.

## Rodar local

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env           # e preencher TELEGRAM_TOKEN + GROQ_API_KEY
python -m src.main
```

Depois mande `/start` para o bot no Telegram (necessário uma vez para ele saber para onde enviar as mensagens agendadas).

## LLM grátis

Padrão: **Groq** (`llama-3.3-70b-versatile`). Crie a chave em https://console.groq.com/keys e coloque em `GROQ_API_KEY`.
Alternativa: **OpenRouter** — `LLM_PROVIDER=openrouter` + `OPENROUTER_API_KEY` (https://openrouter.ai/keys).

Sem chave, o bot ainda funciona com um banco de frases de emergência (para não ficar mudo).

## Deploy (Fly.io — grátis)

```bash
fly launch --no-deploy
fly volumes create aristotelia_data --size 1 --region gru
fly secrets set TELEGRAM_TOKEN=... GROQ_API_KEY=... LLM_PROVIDER=groq
fly deploy
```

## Comandos

`/start` `/hoje` `/jasei` `/skip` `/plano` `/status` `/conteudo` — e texto livre conversa com a treinadora.
