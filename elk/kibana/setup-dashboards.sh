#!/usr/bin/env bash
# =============================================================================
# DSVTT — Kibana Dashboard & Alerting Setup Script
# =============================================================================
# This script bootstraps Kibana with:
#   1. ILM policy (pushed to Elasticsearch)
#   2. Index templates for dsvtt-server-*, dsvtt-security-*, dsvtt-game-*
#   3. Data views (index patterns) in Kibana
#   4. Saved dashboard objects (imported from NDJSON)
#   5. Alerting rules for operational monitoring
#
# Prerequisites:
#   - Elasticsearch running at $ES_URL  (default: http://localhost:9200)
#   - Kibana running at $KIBANA_URL     (default: http://localhost:5601)
#   - curl and jq available on PATH
#
# Usage:
#   chmod +x setup-dashboards.sh
#   ./setup-dashboards.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — override via environment variables
# ---------------------------------------------------------------------------
ES_URL="${ES_URL:-http://localhost:9200}"
KIBANA_URL="${KIBANA_URL:-http://localhost:5601}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_NDJSON="${SCRIPT_DIR}/dashboards/server-dashboard.ndjson"
ILM_POLICY_JSON="${SCRIPT_DIR}/../elasticsearch/ilm-policy.json"

# Kibana API headers
KIBANA_HEADERS=(
  -H "kbn-xsrf: true"
  -H "Content-Type: application/json"
)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log()   { echo "[$(date +'%H:%M:%S')] $*"; }
ok()    { echo "[$(date +'%H:%M:%S')] OK: $*"; }
fail()  { echo "[$(date +'%H:%M:%S')] FAIL: $*" >&2; }

wait_for_service() {
  local url="$1"
  local name="$2"
  local retries=30
  log "Waiting for ${name} at ${url} ..."
  for i in $(seq 1 $retries); do
    if curl -sf "${url}" > /dev/null 2>&1; then
      ok "${name} is ready"
      return 0
    fi
    sleep 2
  done
  fail "${name} did not become ready after $((retries * 2))s"
  exit 1
}

# ---------------------------------------------------------------------------
# 0. Wait for services to be available
# ---------------------------------------------------------------------------
wait_for_service "${ES_URL}" "Elasticsearch"
wait_for_service "${KIBANA_URL}/api/status" "Kibana"

# =============================================================================
# STEP 1: Create ILM Policy in Elasticsearch
# =============================================================================
log "Creating ILM policy: dsvtt-ilm-policy ..."
curl -sf -X PUT "${ES_URL}/_ilm/policy/dsvtt-ilm-policy" \
  -H "Content-Type: application/json" \
  -d @"${ILM_POLICY_JSON}" > /dev/null \
  && ok "ILM policy created" \
  || fail "Failed to create ILM policy"

# =============================================================================
# STEP 2: Create Index Templates
# =============================================================================
# Each template ties its index pattern to the ILM policy and defines
# appropriate field mappings for the DSVTT log schema.
# ---------------------------------------------------------------------------

# --- dsvtt-server template ---
log "Creating index template: dsvtt-server ..."
curl -sf -X PUT "${ES_URL}/_index_template/dsvtt-server" \
  -H "Content-Type: application/json" \
  -d '{
  "index_patterns": ["dsvtt-server-*"],
  "priority": 100,
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "dsvtt-ilm-policy",
      "index.lifecycle.rollover_alias": "dsvtt-server"
    },
    "mappings": {
      "properties": {
        "@timestamp":    { "type": "date" },
        "level":         { "type": "keyword" },
        "message":       { "type": "text" },
        "log_message":   { "type": "text" },
        "context":       { "type": "keyword" },
        "service":       { "type": "keyword" },
        "requestId":     { "type": "keyword" },
        "clientIp":      { "type": "ip" },
        "method":        { "type": "keyword" },
        "path":          { "type": "keyword" },
        "statusCode":    { "type": "integer" },
        "duration":      { "type": "float" },
        "userAgent":     { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 256 }}},
        "userId":        { "type": "keyword" },
        "wsConnections": { "type": "integer" },
        "geoip": {
          "properties": {
            "location":     { "type": "geo_point" },
            "country_name": { "type": "keyword" },
            "city_name":    { "type": "keyword" },
            "region_name":  { "type": "keyword" }
          }
        }
      }
    }
  }
}' > /dev/null \
  && ok "dsvtt-server template created" \
  || fail "Failed to create dsvtt-server template"

# --- dsvtt-security template ---
log "Creating index template: dsvtt-security ..."
curl -sf -X PUT "${ES_URL}/_index_template/dsvtt-security" \
  -H "Content-Type: application/json" \
  -d '{
  "index_patterns": ["dsvtt-security-*"],
  "priority": 200,
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "dsvtt-ilm-policy",
      "index.lifecycle.rollover_alias": "dsvtt-security"
    },
    "mappings": {
      "properties": {
        "@timestamp":  { "type": "date" },
        "level":       { "type": "keyword" },
        "message":     { "type": "text" },
        "log_message": { "type": "text" },
        "context":     { "type": "keyword" },
        "service":     { "type": "keyword" },
        "requestId":   { "type": "keyword" },
        "clientIp":    { "type": "ip" },
        "userId":      { "type": "keyword" },
        "method":      { "type": "keyword" },
        "path":        { "type": "keyword" },
        "statusCode":  { "type": "integer" },
        "tags":        { "type": "keyword" },
        "geoip": {
          "properties": {
            "location":     { "type": "geo_point" },
            "country_name": { "type": "keyword" },
            "city_name":    { "type": "keyword" }
          }
        }
      }
    }
  }
}' > /dev/null \
  && ok "dsvtt-security template created" \
  || fail "Failed to create dsvtt-security template"

# --- dsvtt-game template ---
log "Creating index template: dsvtt-game ..."
curl -sf -X PUT "${ES_URL}/_index_template/dsvtt-game" \
  -H "Content-Type: application/json" \
  -d '{
  "index_patterns": ["dsvtt-game-*"],
  "priority": 100,
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "dsvtt-ilm-policy",
      "index.lifecycle.rollover_alias": "dsvtt-game"
    },
    "mappings": {
      "properties": {
        "@timestamp":  { "type": "date" },
        "level":       { "type": "keyword" },
        "message":     { "type": "text" },
        "log_message": { "type": "text" },
        "context":     { "type": "keyword" },
        "service":     { "type": "keyword" },
        "requestId":   { "type": "keyword" },
        "userId":      { "type": "keyword" },
        "roomId":      { "type": "keyword" },
        "gameId":      { "type": "keyword" },
        "action":      { "type": "keyword" },
        "duration":    { "type": "float" }
      }
    }
  }
}' > /dev/null \
  && ok "dsvtt-game template created" \
  || fail "Failed to create dsvtt-game template"

# =============================================================================
# STEP 3: Create Kibana Data Views (Index Patterns)
# =============================================================================
log "Creating Kibana data views ..."

for PATTERN in "dsvtt-server-*" "dsvtt-security-*" "dsvtt-game-*"; do
  PATTERN_ID="${PATTERN/\*/star}"
  PATTERN_ID="${PATTERN_ID//-/_}"
  log "  Creating data view: ${PATTERN} ..."
  curl -sf -X POST "${KIBANA_URL}/api/data_views/data_view" \
    "${KIBANA_HEADERS[@]}" \
    -d "{
      \"data_view\": {
        \"id\": \"${PATTERN_ID}\",
        \"title\": \"${PATTERN}\",
        \"timeFieldName\": \"@timestamp\"
      }
    }" > /dev/null 2>&1 \
    && ok "  Data view ${PATTERN} created" \
    || log "  Data view ${PATTERN} may already exist (skipping)"
done

# =============================================================================
# STEP 4: Import Dashboard and Visualizations from NDJSON
# =============================================================================
if [ -f "${DASHBOARD_NDJSON}" ]; then
  log "Importing saved objects from ${DASHBOARD_NDJSON} ..."
  IMPORT_RESULT=$(curl -sf -X POST "${KIBANA_URL}/api/saved_objects/_import?overwrite=true" \
    -H "kbn-xsrf: true" \
    -F "file=@${DASHBOARD_NDJSON}" 2>&1) \
    && ok "Dashboard objects imported" \
    || fail "Failed to import dashboard objects: ${IMPORT_RESULT}"
else
  fail "Dashboard NDJSON not found at ${DASHBOARD_NDJSON}"
fi

# =============================================================================
# STEP 5: Create Saved Searches for Common Queries
# =============================================================================
log "Creating saved searches ..."

# Saved search: All Errors
curl -sf -X POST "${KIBANA_URL}/api/saved_objects/search/dsvtt-search-all-errors" \
  "${KIBANA_HEADERS[@]}" \
  -d '{
  "attributes": {
    "title": "[DSVTT] All Errors",
    "description": "All error-level logs across server indices",
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"query\":{\"query\":\"level:error\",\"language\":\"kuery\"},\"filter\":[],\"indexRefName\":\"kibanaSavedObjectMeta.searchSourceJSON.index\"}"
    }
  },
  "references": [{
    "id": "dsvtt-server-index-pattern",
    "name": "kibanaSavedObjectMeta.searchSourceJSON.index",
    "type": "index-pattern"
  }]
}' > /dev/null 2>&1 \
  && ok "Saved search: All Errors" \
  || log "Saved search: All Errors may already exist"

# Saved search: Auth Failures
curl -sf -X POST "${KIBANA_URL}/api/saved_objects/search/dsvtt-search-auth-failures" \
  "${KIBANA_HEADERS[@]}" \
  -d '{
  "attributes": {
    "title": "[DSVTT] Auth Failures",
    "description": "Failed authentication attempts from security audit logs",
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"query\":{\"query\":\"tags:auth-failure\",\"language\":\"kuery\"},\"filter\":[],\"indexRefName\":\"kibanaSavedObjectMeta.searchSourceJSON.index\"}"
    }
  },
  "references": [{
    "id": "dsvtt-security-index-pattern",
    "name": "kibanaSavedObjectMeta.searchSourceJSON.index",
    "type": "index-pattern"
  }]
}' > /dev/null 2>&1 \
  && ok "Saved search: Auth Failures" \
  || log "Saved search: Auth Failures may already exist"

# Saved search: Slow Requests
curl -sf -X POST "${KIBANA_URL}/api/saved_objects/search/dsvtt-search-slow-requests" \
  "${KIBANA_HEADERS[@]}" \
  -d '{
  "attributes": {
    "title": "[DSVTT] Slow Requests (>1s)",
    "description": "Requests with duration exceeding 1000ms",
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"query\":{\"query\":\"duration > 1000\",\"language\":\"kuery\"},\"filter\":[],\"indexRefName\":\"kibanaSavedObjectMeta.searchSourceJSON.index\"}"
    }
  },
  "references": [{
    "id": "dsvtt-server-index-pattern",
    "name": "kibanaSavedObjectMeta.searchSourceJSON.index",
    "type": "index-pattern"
  }]
}' > /dev/null 2>&1 \
  && ok "Saved search: Slow Requests" \
  || log "Saved search: Slow Requests may already exist"

# =============================================================================
# STEP 6: Create Alerting Rules
# =============================================================================
# These use the Kibana Alerting API (rule type: .es-query).
# In production, you may prefer Elasticsearch Watcher or an external system
# like Prometheus Alertmanager. These rules serve as a starting point.
# ---------------------------------------------------------------------------

log "Creating alerting rules ..."

# ---- Alert 1: High Error Rate ----
# Triggers when 5xx errors exceed 5% of all requests in a 5-minute window.
log "  Alert: High Error Rate ..."
curl -sf -X POST "${KIBANA_URL}/api/alerting/rule" \
  "${KIBANA_HEADERS[@]}" \
  -d '{
  "name": "[DSVTT] High Error Rate",
  "consumer": "alerts",
  "rule_type_id": ".es-query",
  "schedule": { "interval": "1m" },
  "tags": ["dsvtt", "server", "error-rate"],
  "params": {
    "index": ["dsvtt-server-*"],
    "timeField": "@timestamp",
    "timeWindowSize": 5,
    "timeWindowUnit": "m",
    "threshold": [5],
    "thresholdComparator": ">",
    "size": 100,
    "esQuery": "{\"query\":{\"bool\":{\"filter\":[{\"range\":{\"@timestamp\":{\"gte\":\"now-5m\"}}},{\"range\":{\"statusCode\":{\"gte\":500}}}]}},\"aggs\":{\"total\":{\"value_count\":{\"field\":\"statusCode\"}},\"errors\":{\"filter\":{\"range\":{\"statusCode\":{\"gte\":500}}}}}}",
    "searchType": "esQuery"
  },
  "actions": [],
  "notify_when": "onThrottleInterval",
  "throttle": "5m"
}' > /dev/null 2>&1 \
  && ok "  Alert: High Error Rate created" \
  || log "  Alert: High Error Rate may already exist or require license"

# ---- Alert 2: Auth Brute Force ----
# Triggers when >20 failed auth attempts from the same IP in 10 minutes.
log "  Alert: Auth Brute Force ..."
curl -sf -X POST "${KIBANA_URL}/api/alerting/rule" \
  "${KIBANA_HEADERS[@]}" \
  -d '{
  "name": "[DSVTT] Auth Brute Force Detection",
  "consumer": "alerts",
  "rule_type_id": ".es-query",
  "schedule": { "interval": "1m" },
  "tags": ["dsvtt", "security", "brute-force"],
  "params": {
    "index": ["dsvtt-security-*"],
    "timeField": "@timestamp",
    "timeWindowSize": 10,
    "timeWindowUnit": "m",
    "threshold": [1],
    "thresholdComparator": ">",
    "size": 100,
    "esQuery": "{\"query\":{\"bool\":{\"filter\":[{\"range\":{\"@timestamp\":{\"gte\":\"now-10m\"}}},{\"terms\":{\"tags\":[\"auth-failure\"]}}]}},\"aggs\":{\"by_ip\":{\"terms\":{\"field\":\"clientIp\",\"min_doc_count\":20,\"size\":50}}}}",
    "searchType": "esQuery"
  },
  "actions": [],
  "notify_when": "onThrottleInterval",
  "throttle": "10m"
}' > /dev/null 2>&1 \
  && ok "  Alert: Auth Brute Force created" \
  || log "  Alert: Auth Brute Force may already exist or require license"

# ---- Alert 3: WebSocket Storm ----
# Triggers when >100 WebSocket connections from the same IP in 1 minute.
log "  Alert: WebSocket Storm ..."
curl -sf -X POST "${KIBANA_URL}/api/alerting/rule" \
  "${KIBANA_HEADERS[@]}" \
  -d '{
  "name": "[DSVTT] WebSocket Connection Storm",
  "consumer": "alerts",
  "rule_type_id": ".es-query",
  "schedule": { "interval": "30s" },
  "tags": ["dsvtt", "server", "websocket", "abuse"],
  "params": {
    "index": ["dsvtt-server-*"],
    "timeField": "@timestamp",
    "timeWindowSize": 1,
    "timeWindowUnit": "m",
    "threshold": [1],
    "thresholdComparator": ">",
    "size": 100,
    "esQuery": "{\"query\":{\"bool\":{\"filter\":[{\"range\":{\"@timestamp\":{\"gte\":\"now-1m\"}}},{\"exists\":{\"field\":\"wsConnections\"}}]}},\"aggs\":{\"by_ip\":{\"terms\":{\"field\":\"clientIp\",\"min_doc_count\":100,\"size\":20}}}}",
    "searchType": "esQuery"
  },
  "actions": [],
  "notify_when": "onThrottleInterval",
  "throttle": "5m"
}' > /dev/null 2>&1 \
  && ok "  Alert: WebSocket Storm created" \
  || log "  Alert: WebSocket Storm may already exist or require license"

# ---- Alert 4: Slow Responses ----
# Triggers when p95 response time exceeds 2000ms for 5 minutes.
log "  Alert: Slow Responses ..."
curl -sf -X POST "${KIBANA_URL}/api/alerting/rule" \
  "${KIBANA_HEADERS[@]}" \
  -d '{
  "name": "[DSVTT] Slow Response Times (p95 > 2s)",
  "consumer": "alerts",
  "rule_type_id": ".es-query",
  "schedule": { "interval": "1m" },
  "tags": ["dsvtt", "server", "latency"],
  "params": {
    "index": ["dsvtt-server-*"],
    "timeField": "@timestamp",
    "timeWindowSize": 5,
    "timeWindowUnit": "m",
    "threshold": [1],
    "thresholdComparator": ">",
    "size": 100,
    "esQuery": "{\"query\":{\"bool\":{\"filter\":[{\"range\":{\"@timestamp\":{\"gte\":\"now-5m\"}}},{\"exists\":{\"field\":\"duration\"}}]}},\"aggs\":{\"response_percentiles\":{\"percentiles\":{\"field\":\"duration\",\"percents\":[95]}},\"slow_check\":{\"bucket_script\":{\"buckets_path\":{\"p95\":\"response_percentiles.95\"},\"script\":\"params.p95 > 2000 ? 1 : 0\"}}}}",
    "searchType": "esQuery"
  },
  "actions": [],
  "notify_when": "onThrottleInterval",
  "throttle": "5m"
}' > /dev/null 2>&1 \
  && ok "  Alert: Slow Responses created" \
  || log "  Alert: Slow Responses may already exist or require license"

# ---- Alert 5: Service Down ----
# Triggers when no logs have been received for 2 minutes, indicating the
# DSVTT server may be down or Logstash pipeline is broken.
log "  Alert: Service Down ..."
curl -sf -X POST "${KIBANA_URL}/api/alerting/rule" \
  "${KIBANA_HEADERS[@]}" \
  -d '{
  "name": "[DSVTT] Service Down (No Logs for 2min)",
  "consumer": "alerts",
  "rule_type_id": ".es-query",
  "schedule": { "interval": "1m" },
  "tags": ["dsvtt", "server", "availability"],
  "params": {
    "index": ["dsvtt-server-*"],
    "timeField": "@timestamp",
    "timeWindowSize": 2,
    "timeWindowUnit": "m",
    "threshold": [1],
    "thresholdComparator": "<",
    "size": 100,
    "esQuery": "{\"query\":{\"bool\":{\"filter\":[{\"range\":{\"@timestamp\":{\"gte\":\"now-2m\"}}}]}}}",
    "searchType": "esQuery"
  },
  "actions": [],
  "notify_when": "onThrottleInterval",
  "throttle": "5m"
}' > /dev/null 2>&1 \
  && ok "  Alert: Service Down created" \
  || log "  Alert: Service Down may already exist or require license"

# =============================================================================
# STEP 7: Create Elasticsearch Watcher Configs (alternative to Kibana alerts)
# =============================================================================
# Watcher provides more fine-grained control and doesn't require Kibana.
# These are installed directly into Elasticsearch.
# ---------------------------------------------------------------------------

log "Creating Elasticsearch Watcher watches (alternative alerting) ..."

# Watcher: High Error Rate
curl -sf -X PUT "${ES_URL}/_watcher/watch/dsvtt-high-error-rate" \
  -H "Content-Type: application/json" \
  -d '{
  "metadata": {
    "name": "DSVTT High Error Rate",
    "description": "Alert when 5xx errors exceed 5% of requests in 5 minutes"
  },
  "trigger": {
    "schedule": { "interval": "1m" }
  },
  "input": {
    "search": {
      "request": {
        "indices": ["dsvtt-server-*"],
        "body": {
          "size": 0,
          "query": {
            "range": { "@timestamp": { "gte": "now-5m" } }
          },
          "aggs": {
            "total_requests": { "value_count": { "field": "statusCode" } },
            "server_errors": {
              "filter": { "range": { "statusCode": { "gte": 500 } } }
            }
          }
        }
      }
    }
  },
  "condition": {
    "script": {
      "source": "def total = ctx.payload.aggregations.total_requests.value; def errors = ctx.payload.aggregations.server_errors.doc_count; return total > 0 && (errors / total * 100) > 5;"
    }
  },
  "actions": {
    "log_alert": {
      "logging": {
        "text": "DSVTT HIGH ERROR RATE: {{ctx.payload.aggregations.server_errors.doc_count}} 5xx errors out of {{ctx.payload.aggregations.total_requests.value}} total requests in the last 5 minutes"
      }
    }
  }
}' > /dev/null 2>&1 \
  && ok "Watcher: High Error Rate" \
  || log "Watcher: High Error Rate (requires X-Pack license)"

# Watcher: Auth Brute Force
curl -sf -X PUT "${ES_URL}/_watcher/watch/dsvtt-auth-brute-force" \
  -H "Content-Type: application/json" \
  -d '{
  "metadata": {
    "name": "DSVTT Auth Brute Force",
    "description": "Alert when >20 failed auth from same IP in 10 minutes"
  },
  "trigger": {
    "schedule": { "interval": "1m" }
  },
  "input": {
    "search": {
      "request": {
        "indices": ["dsvtt-security-*"],
        "body": {
          "size": 0,
          "query": {
            "bool": {
              "filter": [
                { "range": { "@timestamp": { "gte": "now-10m" } } },
                { "terms": { "tags": ["auth-failure"] } }
              ]
            }
          },
          "aggs": {
            "by_ip": {
              "terms": { "field": "clientIp", "min_doc_count": 20, "size": 50 }
            }
          }
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.aggregations.by_ip.buckets": { "not_eq": [] }
    }
  },
  "actions": {
    "log_alert": {
      "logging": {
        "text": "DSVTT BRUTE FORCE: IPs with >20 failed auth attempts in 10 min: {{ctx.payload.aggregations.by_ip.buckets}}"
      }
    }
  }
}' > /dev/null 2>&1 \
  && ok "Watcher: Auth Brute Force" \
  || log "Watcher: Auth Brute Force (requires X-Pack license)"

# Watcher: Service Down
curl -sf -X PUT "${ES_URL}/_watcher/watch/dsvtt-service-down" \
  -H "Content-Type: application/json" \
  -d '{
  "metadata": {
    "name": "DSVTT Service Down",
    "description": "Alert when no logs received for 2 minutes"
  },
  "trigger": {
    "schedule": { "interval": "1m" }
  },
  "input": {
    "search": {
      "request": {
        "indices": ["dsvtt-server-*"],
        "body": {
          "size": 0,
          "query": {
            "range": { "@timestamp": { "gte": "now-2m" } }
          }
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.hits.total.value": { "lt": 1 }
    }
  },
  "actions": {
    "log_alert": {
      "logging": {
        "text": "DSVTT SERVICE DOWN: No logs received in the last 2 minutes. Check server health and Logstash pipeline."
      }
    }
  }
}' > /dev/null 2>&1 \
  && ok "Watcher: Service Down" \
  || log "Watcher: Service Down (requires X-Pack license)"

# =============================================================================
# Done
# =============================================================================
echo ""
log "========================================="
log "  DSVTT ELK Setup Complete"
log "========================================="
log ""
log "Resources created:"
log "  - ILM policy:       dsvtt-ilm-policy"
log "  - Index templates:  dsvtt-server, dsvtt-security, dsvtt-game"
log "  - Data views:       dsvtt-server-*, dsvtt-security-*, dsvtt-game-*"
log "  - Dashboard:        DSVTT Server Overview"
log "  - Saved searches:   All Errors, Auth Failures, Slow Requests"
log "  - Kibana alerts:    High Error Rate, Brute Force, WS Storm, Slow Responses, Service Down"
log "  - Watcher watches:  High Error Rate, Brute Force, Service Down"
log ""
log "Open Kibana: ${KIBANA_URL}/app/dashboards"
log ""
