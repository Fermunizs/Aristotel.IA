"""System prompt de cada função. A identidade (persona) vem de bot/coach.py (editável)."""
from __future__ import annotations

from .coach import persona  # noqa: F401  — persona() editável pelo painel

# compat: quem importa PERSONA direto
PERSONA = persona()

MOTIVATION = (
    "Escreva UMA frase provocativa para começar o dia. "
    "Tema: disciplina, construção, carreira ou futuro. "
    "Não pode ser clichê nem frase de coach genérico. Varie o ângulo. "
    "Só a frase, sem aspas, sem emoji, no máximo 2 linhas."
)

LEARNING_GUIDE = (
    "Diga o tópico de hoje e a PRIMEIRA coisa a fazer — só a primeira, um passo de 5 a 10 minutos. "
    "Formato exato:\n"
    "'Hoje: <tópico específico>.'\n"
    "<1 frase de por que isso importa pro objetivo dela>\n"
    "'Começa por: <1 ação concreta e pequena>.'\n"
    "Máximo 4 linhas. PROIBIDO: lista numerada, mais de 1 bloco de código, "
    "'depois faça X e Y', 'escreva N exemplos', mandar ela ler doc / assistir tutorial / "
    "pesquisar (você entrega o passo pronto). Só o primeiro passo."
)

REVIEW_GUIDE = (
    "A pessoa errou o quiz sobre este tópico — trilha adaptativa: hoje é dia de REVISÃO, não tópico novo. "
    "Formato exato:\n"
    "'🔁 Hoje é revisão: <tópico>.'\n"
    "<reexplique o conceito central em 2-3 linhas, do jeito mais simples possível, ângulo diferente do que já foi dito>\n"
    "'Agora tenta de novo: <1 mini-exercício de fixação, pequeno e concreto>.'\n"
    "Máximo 5 linhas. Sem lista numerada, sem culpa — errar faz parte."
)

MICRO_LEARNING = (
    "Explique UMA ideia do tópico de hoje — a mais central — em até 4 linhas, "
    "com no máximo 1 exemplo de código curto (2-4 linhas). "
    "Termine com UMA pergunta que obrigue a pessoa a pensar (prever um resultado, comparar dois casos) "
    "— não decoreba. Formato da última linha: '🎯 <pergunta>'. "
    "PROIBIDO: teoria longa, vários exemplos, lista de tópicos, link/fonte, mandar consultar algo "
    "externo — a explicação é sua, entregue pronta."
)

QUIZ = (
    "Crie um micro-quiz de retenção sobre UM dos tópicos recentes fornecidos, no estilo de duas rodadas. "
    "Rodada 1: enunciado curto (com trecho de código quando ajudar) e 3 alternativas. "
    "Rodada 2 (reforço): uma variação PEQUENA do mesmo conceito, resposta livre e curta, pra ela pensar sem rodar. "
    "Retorne um JSON com as chaves: "
    '"pergunta" (string, pode ter \\n e código), '
    '"alternativas" (objeto com "A","B","C"), '
    '"correta" ("A"|"B"|"C"), '
    '"topico" (string curta), '
    '"explicacao" (1-2 frases, por que a correta é correta), '
    '"reforco" (string, a pergunta da rodada 2 — curta, uma variação), '
    '"reforco_resposta" (string curta, a resposta esperada da rodada 2), '
    '"reforco_explicacao" (1 frase, o porquê da resposta da rodada 2).'
)

INSIGHT = (
    "Dê um insight FORA da sintaxe, ligado à área da pessoa: arquitetura, carreira, produto, "
    "mercado, boas práticas, mentalidade. No máximo 4 linhas, um pensamento só. "
    "Termine com 1 pergunta pra ela pensar (não precisa responder agora). Sem lista, sem textão."
)

CHALLENGE = (
    "Proponha UM desafio prático de no máximo 10 minutos, pequeno e bem definido, "
    "ligado ao tópico fornecido. Enunciado em 2-4 linhas: o que fazer e qual é o resultado esperado. "
    "No máximo 1 bloco de código curto (só os dados de entrada, se precisar). "
    "Inclua a frase 'Não pesquise antes de tentar.' NÃO dê a solução nem dicas."
)

REVIEW_FORMAT = (
    "A pessoa respondeu o fechamento do dia (o que aprendeu / o que fez / o que entendeu melhor). "
    "Transforme a resposta dela em um card, EXATAMENTE neste formato:\n\n"
    "📈 EVOLUÇÃO — {data}\n\n"
    "🧠 Aprendizado\n<1 linha>\n\n"
    "🛠️ Prática\n<1 linha>\n\n"
    "🎯 Evolução\n<1 linha, sincera — se ela consumiu mais do que praticou, aponte isso>"
)

WEEKLY_REVIEW = (
    "Com base nos registros da semana fornecidos, escreva o resumo semanal EXATAMENTE neste formato:\n\n"
    "📊 SUA SEMANA\n\n"
    "Estudou <n> conceitos. Praticou <n>. Resolveu <n> problemas. Publicou <n> conteúdos.\n\n"
    "Maior avanço: <1 linha>\n"
    "Ponto fraco: <1 linha, sincero>\n"
    "🎯 Próxima semana: <1 linha de foco>"
)

CONTENT_PLANNER = (
    "Com base nos tópicos que a pessoa estudou na semana e nas ideias salvas no banco de conteúdo, "
    "sugira 3 peças de conteúdo para o Instagram dela. Formato EXATO:\n\n"
    "📱 CONTEÚDO DA SEMANA\n\n"
    "1️⃣ Carrossel — \"<título chamativo>\"\n"
    "2️⃣ Reel — \"<título chamativo>\"\n"
    "3️⃣ Threads — \"<título chamativo>\"\n\n"
    "Os títulos devem gerar curiosidade e sair do que ela realmente aprendeu."
)

CONTENT_CLASSIFY = (
    "A pessoa descreveu uma ideia de conteúdo. Classifique em um JSON com as chaves: "
    '"tema" (curto), "tipo" ("educativo"|"opiniao"|"bastidor"|"tutorial"), '
    '"formato" ("carrossel"|"reel"|"threads"|"post"), "titulo" (sugestão de título chamativo).'
)

# ── Onboarding ───────────────────────────────────────────────────────
ONB_GOAL = (
    "🎯 O que você quer aprender ou desenvolver?\n\n"
    "Responde específico. Ex: \"JavaScript pra backend\", \"design de produto\", "
    "\"inglês pra reuniões\", \"disciplina pra estudar todo dia\"."
)
ONB_LEVEL = (
    "E hoje, quanto você já sabe disso?\n\n"
    "1 — do zero\n2 — sei o básico\n3 — intermediário, quero aprofundar"
)
ONB_MINUTES = "Quantos minutos por dia você consegue de verdade? (ex: 20, 30, 60)"

ONB_DEEPEN = (
    "A pessoa disse o que quer aprender (abaixo). Antes de montar a trilha, faça 2 a 3 perguntas "
    "curtas pra afinar — como uma consultora faria numa primeira conversa. "
    "As perguntas têm que ser ESPECÍFICAS desse objetivo (nada de genérico tipo 'qual seu nível'), "
    "respondíveis em 1 linha cada, e no conjunto cobrir: pra que ela vai usar isso na prática · "
    "o que ela já conhece de parecido · qual o primeiro resultado concreto que ela quer. "
    "Se o objetivo cita uma ferramenta ou produto, pergunte sobre o uso real dela. "
    "Retorne SOMENTE JSON: {\"perguntas\":[\"...\",\"...\"]}"
)

TRILHA_PLANO = (
    "Você é consultora montando a trilha de 4 semanas de UMA pessoa específica. "
    "Recebe: objetivo, nível, minutos/dia, o contexto que ela deu (uso prático, o que já conhece, "
    "o resultado que quer) e qualquer material de referência que ela colou. "
    "Progressão do concreto pro avançado — nunca 'fundamentos genéricos'. "
    "Se ela citou uma ferramenta/produto, os temas são sobre USAR essa ferramenta pra chegar no "
    "resultado dela, não teoria ao redor. "
    "Cada tema: específico, com o nome real do que vai ser feito "
    "(ex.: 'Primeiro clipe com image-to-video e controle de câmera', não 'Introdução a vídeo com IA'). "
    "Até 9 palavras. "
    "Retorne SOMENTE JSON: {\"themes\":[\"...\",\"...\",\"...\",\"...\"]}"
)

TRILHA_SEMANA = (
    "Detalhe UMA semana da trilha desta pessoa. Você recebe: objetivo, nível, minutos/dia, o contexto "
    "que ela deu, o material de referência, o número e o tema desta semana e os temas das 4 semanas. "
    "5 dias. Cada dia:\n"
    "- topic: o que ela vai fazer nesse dia, ESPECÍFICO — nome real de recurso, tela, parâmetro ou "
    "técnica (até 14 palavras). Proibido genérico: 'introdução a X', 'entender os fundamentos', "
    "'explorar a interface', 'pesquisar sobre'.\n"
    "- goal: a ação concreta que cabe nos minutos/dia + o resultado esperado (até 22 palavras).\n"
    "Se a pessoa citou uma ferramenta específica, TODO dia é mão na ferramenta produzindo algo — "
    "nunca teoria solta. Seja fiel ao que a ferramenta realmente faz (use o material de referência). "
    "Retorne SOMENTE JSON: "
    '{"n":N,"theme":"...","days":[{"d":1,"topic":"...","goal":"..."}, ...5 dias]}'
)


def learning_context(plan: dict) -> str:
    cur = _cur(plan)
    week = _find_week(plan, cur["week"])
    if not week:
        return "Trilha sem semana definida."
    day = _find_day(week, cur["day"])
    known = ", ".join(plan.get("known_topics", [])) or "nenhum"
    lines = [
        f"Semana {week['n']} — {week['theme']}",
        f"Dia {cur['day']} de {len(week['days'])}",
    ]
    if day:
        lines.append(f"Tópico de hoje: {day['topic']}")
        lines.append(f"Objetivo: {day['goal']}")
    lines.append(f"Tópicos que ela já domina (pular): {known}")
    return "\n".join(lines)


def today_topic(plan: dict) -> dict | None:
    week = _find_week(plan, _cur(plan)["week"])
    return _find_day(week, _cur(plan)["day"]) if week else None


def recent_topics(plan: dict, events: list | None = None, n: int = 6) -> str:
    cur = _cur(plan)
    tops: list[str] = []
    for w in plan.get("weeks", []):
        if w["n"] > cur["week"]:
            break
        for d in w.get("days", []):
            if w["n"] == cur["week"] and d["d"] > cur["day"]:
                break
            tops.append(d["topic"])
    for e in (events or [])[-15:]:
        payload = e["payload"] if not isinstance(e, dict) else e.get("payload", {})
        if isinstance(payload, dict) and payload.get("topico"):
            tops.append(payload["topico"])
    seen, out = set(), []
    for t in reversed(tops):
        if t not in seen:
            seen.add(t)
            out.append(t)
        if len(out) >= n:
            break
    return "; ".join(out) or "fundamentos"


def _cur(plan: dict) -> dict:
    if "current" in plan:
        return plan["current"]
    return {"week": plan.get("current_week", 1), "day": plan.get("current_day", 1)}


def _find_week(plan: dict, n: int):
    for w in plan.get("weeks", []):
        if w["n"] == n:
            return w
    return plan.get("weeks", [None])[-1] if plan.get("weeks") else None


def _find_day(week: dict, d: int):
    for day in week.get("days", []):
        if day["d"] == d:
            return day
    return week["days"][-1] if week.get("days") else None
