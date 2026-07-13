WITH search AS (
    SELECT '정광'::text AS keyword
)
SELECT
    l.created_at AS 작업일시,
    l.username AS 아이디,
    u.display_name AS 사용자명,
    l.action AS 작업,
    l.target_table AS 테이블명,
    l.target_id AS 대상ID,
    l.detail AS 상세
FROM app.audit_logs l
LEFT JOIN app.app_users u ON u.id = l.user_id
CROSS JOIN search s
WHERE l.username ILIKE '%' || s.keyword || '%'
   OR u.display_name ILIKE '%' || s.keyword || '%'
ORDER BY l.created_at DESC;