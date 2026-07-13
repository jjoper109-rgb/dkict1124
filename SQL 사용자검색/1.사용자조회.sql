WITH search AS (
    SELECT '김종민'::text AS keyword
)
SELECT
    u.id,
    u.username AS 아이디,
    u.display_name AS 이름,
    u.email AS 이메일,
    u.role AS 권한,
    CASE WHEN u.is_active THEN '사용' ELSE '중지' END AS 사용상태,
    o.name AS 조직,
    e.employee_no AS 사원번호,
    e.employment_status AS 재직상태,
    e.position AS 직급,
    u.created_at AS 계정생성일,
    u.updated_at AS 수정일
FROM app.app_users u
LEFT JOIN app.organizations o ON o.id = u.organization_id
LEFT JOIN app.employee_master e ON e.id = u.employee_id
CROSS JOIN search s
WHERE u.username ILIKE '%' || s.keyword || '%'
   OR u.display_name ILIKE '%' || s.keyword || '%'
   OR u.email ILIKE '%' || s.keyword || '%'
   OR e.name ILIKE '%' || s.keyword || '%'
   OR e.employee_no ILIKE '%' || s.keyword || '%'
ORDER BY u.id;