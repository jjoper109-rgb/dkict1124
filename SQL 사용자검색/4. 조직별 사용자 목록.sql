SELECT
    o.name AS 조직,
    u.username AS 아이디,
    u.display_name AS 이름,
    e.employee_no AS 사원번호,
    e.position AS 직급,
    u.role AS 권한,
    CASE WHEN u.is_active THEN '사용' ELSE '중지' END AS 사용상태
FROM app.app_users u
LEFT JOIN app.organizations o ON o.id = u.organization_id
LEFT JOIN app.employee_master e ON e.id = u.employee_id
ORDER BY o.name, u.role, u.display_name;