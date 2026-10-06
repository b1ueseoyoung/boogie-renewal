#!/usr/bin/env bash
# ComfyUI 기준선 환경 설치(멱등) + 기동 + 스모크. 결과는 docs/baseline-env.md에 쓴다.
# 실패해도 exit 0: 문서에 status: UNAVAILABLE과 오류 꼬리 20줄을 남긴다.
set -u
R="$(cd "$(dirname "$0")/.." && pwd)"
C="$R/.local/ComfyUI"
PY="$C/.venv/bin/python"
DOC="$R/docs/baseline-env.md"
LOG="$R/.local/run/comfy-setup.log"
URL="http://127.0.0.1:8188"
mkdir -p "$R/.local/run" "$R/docs"
: > "$LOG"

fail() { # fail <단계> [꼬리를 뜰 로그]
  {
    echo "# 기준선 환경 (ComfyUI)"
    echo
    echo "status: UNAVAILABLE"
    echo
    echo "- 기록 시각: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "- 실패 단계: $1"
    echo
    echo "## 오류 꼬리 (마지막 20줄)"
    echo
    echo '```text'
    tail -n 20 "${2:-$LOG}" 2>/dev/null
    echo '```'
  } > "$DOC"
  echo "UNAVAILABLE: $1 ($DOC)"
  bash "$R/scripts/comfy-down.sh" >/dev/null 2>&1
  exit 0
}

run() { # run <단계> <명령...>
  echo "== $1" | tee -a "$LOG"
  local step="$1"; shift
  "$@" >> "$LOG" 2>&1 || fail "$step"
}

size_ok() { [ "$(stat -f %z "$1" 2>/dev/null)" = "$2" ]; }

fetch() { # fetch <저장 경로> <바이트> <주소> [미러...]
  local dest="$1" size="$2"; shift 2
  mkdir -p "$(dirname "$dest")"
  while [ $# -gt 0 ]; do
    size_ok "$dest" "$size" && return 0
    echo "download $1 -> $dest"
    curl -L --fail -sS -C - --retry 3 -o "$dest" "$1" || true
    size_ok "$dest" "$size" && return 0
    echo "size mismatch: $(stat -f %z "$dest" 2>/dev/null || echo 0) != $size"
    # ponytail: 크기만 대조한다(해시 없음). 주소를 바꾸기 전이나 크기가 넘치면 버리고,
    # 마지막 주소의 미완성 파일은 다음 실행에서 이어 받게 남긴다.
    if [ $# -gt 1 ] || [ "$(stat -f %z "$dest" 2>/dev/null || echo 0)" -gt "$size" ]; then rm -f "$dest"; fi
    shift
  done
  return 1
}

pip_base() {
  uv pip install --python "$PY" torch torchvision torchaudio &&
  uv pip install --python "$PY" -r "$C/requirements.txt"
}
pip_face() { uv pip install --python "$PY" insightface onnxruntime; }
retry_py311() { uv venv "$C/.venv" --python 3.11 --clear && pip_base && pip_face; }

# 1. 코드
[ -d "$C/.git" ] || run "clone ComfyUI" git clone https://github.com/comfyanonymous/ComfyUI "$C"
[ -d "$C/custom_nodes/ComfyUI_IPAdapter_plus/.git" ] ||
  run "clone ComfyUI_IPAdapter_plus" git clone https://github.com/cubiq/ComfyUI_IPAdapter_plus "$C/custom_nodes/ComfyUI_IPAdapter_plus"

# 2. venv와 패키지 (시스템 Python에는 설치하지 않는다)
[ -x "$PY" ] || run "uv venv 3.12" uv venv "$C/.venv" --python 3.12
run "pip torch + requirements" pip_base
echo "== pip insightface onnxruntime" | tee -a "$LOG"
if ! pip_face >> "$LOG" 2>&1; then
  run "pip insightface (Python 3.11 재시도)" retry_py311
fi
if [ "$("$PY" -c 'import torch; print(torch.backends.mps.is_available())' 2>>"$LOG")" != "True" ]; then
  run "pip torch nightly (MPS 없음)" uv pip install --python "$PY" --pre --upgrade torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/nightly/cpu
fi

# 3. 모델 (교체 금지: 주소와 크기는 계획의 Fixed facts)
M="$C/models"
HF="https://huggingface.co/h94"
run "model toonyou_beta6" fetch "$M/checkpoints/toonyou_beta6.safetensors" 2299933946 \
  https://civitai.com/api/download/models/125771 \
  https://huggingface.co/frankjoshua/toonyou_beta6/resolve/main/toonyou_beta6.safetensors
run "model ip-adapter-faceid-plusv2" fetch "$M/ipadapter/ip-adapter-faceid-plusv2_sd15.bin" 156558509 \
  "$HF/IP-Adapter-FaceID/resolve/main/ip-adapter-faceid-plusv2_sd15.bin"
run "model faceid lora" fetch "$M/loras/ip-adapter-faceid-plusv2_sd15_lora.safetensors" 51059544 \
  "$HF/IP-Adapter-FaceID/resolve/main/ip-adapter-faceid-plusv2_sd15_lora.safetensors"
run "model clip vision" fetch "$M/clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors" 2528373448 \
  "$HF/IP-Adapter/resolve/main/models/image_encoder/model.safetensors"
run "model buffalo_l.zip" fetch "$M/insightface/models/buffalo_l.zip" 288621354 \
  https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip
run "unzip buffalo_l" unzip -o -q "$M/insightface/models/buffalo_l.zip" -d "$M/insightface/models/buffalo_l"

# 4. 기동과 노드 등록 확인
echo "== comfy-up" | tee -a "$LOG"
bash "$R/scripts/comfy-up.sh" >> "$LOG" 2>&1 || fail "comfy-up" "$C/comfy.log"
curl -sf "$URL/object_info/IPAdapterFaceID" 2>>"$LOG" | grep -q IPAdapterFaceID || fail "노드 등록 (IPAdapterFaceID)" "$C/comfy.log"

# 5. 스모크: 첫 사진 업로드 -> illust.json의 6번 글, 12번 이미지만 바꿔 /prompt -> PNG
echo "== smoke" | tee -a "$LOG"
PHOTO="$(find "$R/data/photos" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) 2>/dev/null | sort | head -n 1)"
if [ -z "$PHOTO" ]; then echo "data/photos에 사진이 없다" >> "$LOG"; fail "스모크 (사진 없음)"; fi
UPLOADED="$(curl -sf -F "image=@$PHOTO" -F overwrite=true "$URL/upload/image" 2>>"$LOG" |
  "$PY" -c 'import json,sys; print(json.load(sys.stdin)["name"])' 2>>"$LOG")"
if [ -z "$UPLOADED" ]; then echo "upload/image 실패" >> "$LOG"; fail "스모크 (업로드)"; fi
mkdir -p "$R/data/lab/spike"
SMOKE_S="$(URL="$URL" WF="$R/backend-fastAPI/illust.json" IMG="$UPLOADED" OUT="$R/data/lab/spike/comfy-smoke.png" \
  "$PY" - 2>>"$LOG" <<'EOF'
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
url = os.environ["URL"]
wf = json.load(open(os.environ["WF"], encoding="utf-8"))
wf["6"]["inputs"]["text"] = "test portrait"
wf["12"]["inputs"]["image"] = os.environ["IMG"]
t0 = time.time()
req = urllib.request.Request(url + "/prompt", json.dumps({"prompt": wf}).encode(), {"Content-Type": "application/json"})
try:
    pid = json.load(urllib.request.urlopen(req))["prompt_id"]
except urllib.error.HTTPError as e:
    sys.exit(f"/prompt {e.code}: {e.read().decode()[:2000]}")
deadline = t0 + int(os.environ.get("SMOKE_TIMEOUT_S", "900"))
while time.time() < deadline:
    h = json.load(urllib.request.urlopen(f"{url}/history/{pid}")).get(pid)
    if h:
        if h["status"]["status_str"] != "success":
            sys.exit("prompt failed: " + json.dumps(h["status"])[:2000])
        img = h["outputs"]["9"]["images"][0]
        data = urllib.request.urlopen(url + "/view?" + urllib.parse.urlencode(img)).read()
        open(os.environ["OUT"], "wb").write(data)
        print(f"{time.time() - t0:.1f}")
        sys.exit(0)
    time.sleep(2)
sys.exit("smoke timeout")
EOF
)" || fail "스모크 (/prompt)"
[ -n "$SMOKE_S" ] || fail "스모크 (/prompt)"
DIM="$(sips -g pixelWidth -g pixelHeight "$R/data/lab/spike/comfy-smoke.png" 2>>"$LOG" | awk '/pixel/{printf "%s%s", s, $2; s="x"}')"
if [ "$DIM" != "768x768" ]; then echo "smoke PNG 크기 $DIM" >> "$LOG"; fail "스모크 (PNG 크기)"; fi
# 올린 사진이 data/ 밖(input/)에 남지 않게, 띄운 서버는 여기서 내린다 (M9)
bash "$R/scripts/comfy-down.sh" >> "$LOG" 2>&1

# 6. 기록
{
  echo "# 기준선 환경 (ComfyUI)"
  echo
  echo "status: AVAILABLE"
  echo
  echo "- 기록 시각: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "- ComfyUI 커밋: $(git -C "$C" rev-parse HEAD)"
  echo "- ComfyUI_IPAdapter_plus 커밋: $(git -C "$C/custom_nodes/ComfyUI_IPAdapter_plus" rev-parse HEAD)"
  echo "- Python: $("$PY" -c 'import platform; print(platform.python_version())')"
  echo "- torch: $("$PY" -c 'import torch; print(torch.__version__)')"
  echo "- MPS: $("$PY" -c 'import torch; print(torch.backends.mps.is_available())')"
  echo "- 스모크 소요 시간: ${SMOKE_S}초 (768x768, 30 steps, \`data/lab/spike/comfy-smoke.png\`)"
  echo "- 주소: $URL (127.0.0.1 전용)"
  echo
  echo "## 모델 (바이트)"
  echo
  for f in checkpoints/toonyou_beta6.safetensors ipadapter/ip-adapter-faceid-plusv2_sd15.bin \
    loras/ip-adapter-faceid-plusv2_sd15_lora.safetensors clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors \
    insightface/models/buffalo_l.zip; do
    echo "- \`models/$f\`: $(stat -f %z "$M/$f")"
  done
  echo
  echo "## 사용"
  echo
  echo "- 설치와 스모크: \`bash scripts/comfy-setup.sh\` (멱등, 로그 \`.local/run/comfy-setup.log\`)"
  echo "- 설치 스크립트는 스모크가 끝나면 ComfyUI를 내리고 끝난다. HTTP 확인과 어댑터를 쓰기 전에 \`bash scripts/comfy-up.sh\`를, 쓴 뒤에 \`bash scripts/comfy-down.sh\`를 실행한다."
  echo "- 기동: \`bash scripts/comfy-up.sh\` (로그 \`.local/ComfyUI/comfy.log\`, PID \`.local/run/comfy.pid\`)"
  echo "- 종료: \`bash scripts/comfy-down.sh\` (\`.local/ComfyUI/input\`과 \`output\`의 파일을 지운다)"
} > "$DOC"
echo "AVAILABLE ($DOC)"
