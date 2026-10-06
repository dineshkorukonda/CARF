# Generic CI & HTTP API Integration Guide

This guide details integrating non-GitHub pipelines (**GitLab CI**, **Jenkins**, **CircleCI**, **Bitbucket**, or bare shell scripts) using CARF's standard HTTP REST endpoints.

---

## Standard Endpoints

1. **Pre-Deployment Risk Assessment**:
   - `GET /v1/augment/threshold?owner={owner}&repo={repo}&sha={sha}`
   - Returns: `{ "threshold": 0.035, "soakWindowSeconds": 240, "recommendation": "TIGHTEN_GATING" }`

2. **Soak Telemetry & Health Reporting**:
   - `POST /v1/report`
   - Payload: `{ "sha": "{sha}", "errorRate": 0.001, "healthy": true }`
   - Response: `{ "status": "continue" }` or `{ "status": "rollback", "reason": "threshold_exceeded" }`

---

## GitLab CI Example (`.gitlab-ci.yml`)

```yaml
stages:
  - test
  - carf_gate
  - deploy
  - carf_soak

carf_gate:
  stage: carf_gate
  image: curlimages/curl:latest
  script:
    - |
      RESP=$(curl -s -f -H "Authorization: Bearer $CARF_API_KEY" \
        "https://api.carf.dev/v1/augment/threshold?owner=$CI_PROJECT_NAMESPACE&repo=$CI_PROJECT_NAME&sha=$CI_COMMIT_SHA")
      CEILING=$(echo $RESP | jq -r .threshold)
      echo "CARF Dynamic Ceiling: $CEILING"

deploy:
  stage: deploy
  script:
    - ./deploy.sh $CI_COMMIT_SHA

carf_soak:
  stage: carf_soak
  image: curlimages/curl:latest
  script:
    - |
      RESULT=$(curl -s -f -X POST "https://api.carf.dev/v1/report" \
        -H "Authorization: Bearer $CARF_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"sha\": \"$CI_COMMIT_SHA\", \"errorRate\": 0.0, \"healthy\": true}")
      STATUS=$(echo $RESULT | jq -r .status)
      if [ "$STATUS" = "rollback" ]; then
        echo "Breach detected! Initiating rollback..."
        ./rollback.sh
        exit 1
      fi
```
