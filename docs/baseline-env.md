# 기준선 환경 (ComfyUI)

status: AVAILABLE

- 기록 시각: 2026-10-02 17:42:46 KST
- ComfyUI 커밋: 65787d668397d230bf5839d69a0a7239e2dad378
- ComfyUI_IPAdapter_plus 커밋: a0f451a5113cf9becb0847b92884cb10cbdec0ef
- Python: 3.12.14
- torch: 2.14.1
- MPS: True
- 스모크 소요 시간: 37.1초 (768x768, 30 steps, `data/lab/spike/comfy-smoke.png`)
- 주소: http://127.0.0.1:8188 (127.0.0.1 전용)

## 모델 (바이트)

- `models/checkpoints/toonyou_beta6.safetensors`: 2299933946
- `models/ipadapter/ip-adapter-faceid-plusv2_sd15.bin`: 156558509
- `models/loras/ip-adapter-faceid-plusv2_sd15_lora.safetensors`: 51059544
- `models/clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors`: 2528373448
- `models/insightface/models/buffalo_l.zip`: 288621354

## 사용

- 설치와 스모크: `bash scripts/comfy-setup.sh` (멱등, 로그 `.local/run/comfy-setup.log`)
- 설치 스크립트는 스모크가 끝나면 ComfyUI를 내리고 끝난다. HTTP 확인과 어댑터를 쓰기 전에 `bash scripts/comfy-up.sh`를, 쓴 뒤에 `bash scripts/comfy-down.sh`를 실행한다.
- 기동: `bash scripts/comfy-up.sh` (로그 `.local/ComfyUI/comfy.log`, PID `.local/run/comfy.pid`)
- 종료: `bash scripts/comfy-down.sh` (`.local/ComfyUI/input`과 `output`의 파일을 지운다)
