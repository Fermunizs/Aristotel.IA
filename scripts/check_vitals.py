"""Asserções do parser de /proc e da coleta de vitais (bot/vitals.py).

Roda com: ./.venv/Scripts/python.exe scripts/check_vitals.py
Não depende de estar num Linux — testa o parser com fixtures e confirma que
collect() nunca levanta exceção (degrada em dev).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import vitals as V  # noqa: E402

MEMINFO = """MemTotal:         987654 kB
MemFree:          123456 kB
MemAvailable:     234567 kB
Buffers:           10000 kB
SwapTotal:       1048576 kB
SwapFree:         900000 kB
"""


def test_meminfo_parse(monkey):
    monkey(MEMINFO)
    d = V._meminfo()
    assert d["mem_total_mb"] == 987654 // 1024, d
    assert d["mem_available_mb"] == 234567 // 1024, d
    assert d["swap_total_mb"] == 1048576 // 1024, d
    assert d["swap_free_mb"] == 900000 // 1024, d


def test_loadavg_parse(monkey):
    monkey("0.42 0.31 0.25 1/234 5678\n")
    d = V._loadavg()
    assert d == {"cpu_load_1": 0.42, "cpu_load_5": 0.31, "cpu_load_15": 0.25}, d


def test_degrada_sem_proc():
    # força leitura a falhar -> dicts vazios, sem exceção
    orig = V.Path
    try:
        V.Path = lambda *_a, **_k: (_ for _ in ()).throw(FileNotFoundError())
        assert V._meminfo() == {}
        assert V._loadavg() == {}
    finally:
        V.Path = orig


def test_collect_nunca_quebra():
    row = V.collect()
    for k in ("cpu_load_1", "mem_total_mb", "services", "bot_uptime_seconds"):
        assert k in row, k
    assert isinstance(row["services"], dict)
    assert isinstance(row["bot_uptime_seconds"], int)


def _monkey_reader(text):
    """substitui Path(...).read_text() por um retorno fixo."""
    class _P:
        def __init__(self, *_a, **_k): ...
        def read_text(self, *_a, **_k): return text
    V.Path = _P


def main():
    orig = V.Path
    try:
        test_meminfo_parse(_monkey_reader)
        test_loadavg_parse(_monkey_reader)
    finally:
        V.Path = orig
    test_degrada_sem_proc()
    test_collect_nunca_quebra()
    print("check_vitals: OK")


if __name__ == "__main__":
    main()
