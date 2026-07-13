SELECT
    l.id,
    l.username AS 아이디,
    u.display_name AS 사용자명,
    l.action AS 작업,
    l.target_table AS 테이블명,
    l.target_id AS 대상ID,
    l.detail AS 상세,
    l.created_at AS 작업일시
FROM app.audit_logs l
LEFT JOIN app.app_users u ON u.id = l.user_id
ORDER BY l.created_at DESC
LIMIT 200;