#!/usr/bin/env bash
# Test 5: Sales Worker → GET /users → 403 PERMISSION_DENIED
set -uo pipefail
API="http://localhost:3001/api/v1"

echo "=== Test 5: Sales Worker → GET /users → 403 PERMISSION_DENIED ==="
echo

echo "--- Setup: clean any pre-existing 'mariam' ---"
PGPASSWORD=postgres psql -U postgres -h localhost -d grocery_dev -c "
  DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username='mariam');
  DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username='mariam');
  DELETE FROM users WHERE username='mariam';
" 2>&1 | tail -3
echo

echo "--- Login as Owner ---"
OWNER_LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"owner","password":"Owner@12345"}')
OWNER_TOKEN=$(echo "$OWNER_LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
echo "OWNER_TOKEN length: ${#OWNER_TOKEN}"
echo

echo "--- Find SalesWorker role id ---"
SW_ROLE_ID=$(PGPASSWORD=postgres psql -U postgres -h localhost -d grocery_dev -tAc "SELECT id FROM roles WHERE key='SalesWorker' OR key='sales_worker' LIMIT 1;")
echo "Sales Worker role id: $SW_ROLE_ID"
echo

echo "--- Create mariam (SalesWorker) via POST /users (Owner token) ---"
CREATE_BODY=$(printf '{"username":"mariam","password":"Mariam@12345","fullName":"مريم","roleIds":["%s"]}' "$SW_ROLE_ID")
CREATE_RES=$(curl -s -X POST "$API/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "$CREATE_BODY")
echo "$CREATE_RES" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RES"
echo

echo "--- Login as mariam ---"
MARIAM_LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"mariam","password":"Mariam@12345"}')
MARIAM_TOKEN=$(echo "$MARIAM_LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
echo "MARIAM_TOKEN length: ${#MARIAM_TOKEN}"
if [[ -z "$MARIAM_TOKEN" ]]; then
  echo "Login failed; raw response:"
  echo "$MARIAM_LOGIN"
  exit 1
fi
echo

echo "--- Mariam's permissions (sample) ---"
echo "$MARIAM_LOGIN" | python3 -c "
import sys,json
d = json.load(sys.stdin)['data']
print('roles:', d['user']['roles'])
print('permissions count:', len(d['user']['permissions']))
print('has users.view:', 'users.view' in d['user']['permissions'])
print('first 5 perms:', d['user']['permissions'][:5])
"
echo

echo "--- Test 5: Mariam → GET /users → expect 403 ---"
curl -i -s -X GET "$API/users" \
  -H "Authorization: Bearer $MARIAM_TOKEN" | sed -n '1p;/^X-Request-Id\|^Content-Type\|^HTTP\|^$/p;/^{/p'
echo

echo "--- Sanity: Mariam CAN access /auth/me (no permission required) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "$API/auth/me" \
  -H "Authorization: Bearer $MARIAM_TOKEN" | python3 -m json.tool 2>/dev/null | head -25
