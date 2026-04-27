-- 旧 checker_state(default) の state を、指定ユーザーの user_state へ移行するスクリプト
-- 実行前に target_username を実ユーザー名へ変更してください。
-- 例: v_target_username := 'alice';

BEGIN;

DO $$
DECLARE
  v_target_username text := 'alice';
  v_target_user_id integer;
  v_legacy_state jsonb;
BEGIN
  -- 必須テーブル確認
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'users テーブルが存在しません';
  END IF;

  IF to_regclass('public.user_state') IS NULL THEN
    RAISE EXCEPTION 'user_state テーブルが存在しません';
  END IF;

  IF to_regclass('public.checker_state') IS NULL THEN
    RAISE EXCEPTION 'checker_state テーブルが存在しません';
  END IF;

  -- 対象ユーザー確認
  SELECT id INTO v_target_user_id
  FROM users
  WHERE username = v_target_username
  LIMIT 1;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION '対象ユーザーが見つかりません: %', v_target_username;
  END IF;

  -- 旧 default state 取得
  SELECT state::jsonb INTO v_legacy_state
  FROM checker_state
  WHERE id = 'default'
  LIMIT 1;

  IF v_legacy_state IS NULL THEN
    RAISE EXCEPTION 'checker_state.id = default のデータが見つかりません';
  END IF;

  -- 既存 user_state があれば更新
  UPDATE user_state
  SET state = v_legacy_state,
      updated_at = NOW()
  WHERE user_id = v_target_user_id;

  -- 既存がなければ作成
  IF NOT FOUND THEN
    INSERT INTO user_state (user_id, state, updated_at)
    VALUES (v_target_user_id, v_legacy_state, NOW());
  END IF;

  RAISE NOTICE '移行完了: username=%, user_id=%', v_target_username, v_target_user_id;
END $$;

COMMIT;
