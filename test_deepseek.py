import json
import os
import urllib.request

def load_env(path=".env"):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value)

load_env()
api_key = os.environ["DEEPSEEK_API_KEY"]

payload = {
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "こんにちは、動作確認です。一言返事をしてください。"}],
}

req = urllib.request.Request(
    "https://api.deepseek.com/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    },
)

with urllib.request.urlopen(req) as res:
    result = json.loads(res.read())
    print(result["choices"][0]["message"]["content"])
