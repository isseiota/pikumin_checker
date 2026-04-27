-- user_state.state(JSONB) を user_check_states(1行1項目) へ移行するスクリプト
-- 既存の user_check_states が空でないユーザーにも上書き反映します。

BEGIN;

CREATE TABLE IF NOT EXISTS user_check_states (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id VARCHAR(100) NOT NULL,
  is_checked BOOLEAN NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_check_states_user_id
ON user_check_states (user_id);

WITH expanded AS (
  SELECT
    us.user_id,
    kv.key AS item_id,
    CASE
      WHEN lower(kv.value) = 'true' THEN true
      WHEN lower(kv.value) = 'false' THEN false
      ELSE false
    END AS is_checked
  FROM user_state us,
       jsonb_each_text(us.state) AS kv(key, value)
)
INSERT INTO user_check_states (user_id, item_id, is_checked, updated_at)
SELECT user_id, item_id, is_checked, NOW()
FROM expanded
ON CONFLICT (user_id, item_id)
DO UPDATE SET
  is_checked = EXCLUDED.is_checked,
  updated_at = NOW();

COMMIT;
