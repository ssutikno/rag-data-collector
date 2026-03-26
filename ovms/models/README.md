# Models directory — OpenVINO Model Server
#
# Place OpenVINO IR models here. Each model requires its own subdirectory
# with a versioned subfolder containing .xml and .bin files:
#
#   models/
#   └── bge-small-en/          ← model name (must match name in config.json)
#       └── 1/                 ← version number (integer, start at 1)
#           ├── model.xml
#           └── model.bin
#
# ─── How to add an embedding model ─────────────────────────────────────────
#
# Requirements: pip install optimum[openvino] huggingface_hub
#
# BGE Small English (384-dim, ~130MB, fast):
#   optimum-cli export openvino \
#     --model BAAI/bge-small-en-v1.5 \
#     --task feature-extraction \
#     --weight-format int8 \
#     ovms/models/bge-small-en/1
#
# BGE Base English (768-dim, ~440MB, better quality):
#   optimum-cli export openvino \
#     --model BAAI/bge-base-en-v1.5 \
#     --task feature-extraction \
#     --weight-format int8 \
#     ovms/models/bge-base-en/1
#
# Multilingual E5 Small (384-dim, supports Indonesian + English):
#   optimum-cli export openvino \
#     --model intfloat/multilingual-e5-small \
#     --task feature-extraction \
#     --weight-format int8 \
#     ovms/models/multilingual-e5-small/1
#
# ─── How to add a chat/LLM model ────────────────────────────────────────────
# (required for OpenWebUI's OpenAI-compatible endpoint via OVMS)
#
# Phi-3 Mini (3.8B, good for CPU inference):
#   optimum-cli export openvino \
#     --model microsoft/Phi-3-mini-4k-instruct \
#     --task text-generation-with-past \
#     --weight-format int4 \
#     ovms/models/phi-3-mini/1
#
# After adding a model, update ovms/config.json and restart:
#   docker compose restart ovms
#
# Verify the model loaded:
#   curl http://localhost:8001/v2/models/<model-name>/ready
