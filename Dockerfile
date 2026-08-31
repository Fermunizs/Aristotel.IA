FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    TZ=America/Sao_Paulo

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "src.main"]
