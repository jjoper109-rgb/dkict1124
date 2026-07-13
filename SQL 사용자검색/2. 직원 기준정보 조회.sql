WITH search AS (
    SELECT '김종민'::text AS keyword
)
SELECT
    e.id,
    e.employee_no AS 사원번호,
    e.name AS 이름,
    e.employment_status AS 재직상태,
    CASE WHEN e.is_active THEN '사용' ELSE '중지' END AS 사용상태,
    o.name AS 조직,
    d.parent_name AS 부서1,
    d.name AS 부서2,
    p.name AS 직급,
    e.email AS 이메일,
    e.joined_at AS 입사일,
    e.resigned_at AS 퇴사일,
    e.memo AS 비고
FROM app.employee_master e
LEFT JOIN app.organizations o ON o.id = e.organization_id
LEFT JOIN app.employee_departments d ON d.code = e.department_code
LEFT JOIN app.employee_positions p ON p.code = e.position_code
CROSS JOIN search s
WHERE e.employee_no ILIKE '%' || s.keyword || '%'
   OR e.name ILIKE '%' || s.keyword || '%'
   OR e.email ILIKE '%' || s.keyword || '%'
   OR o.name ILIKE '%' || s.keyword || '%'
   OR d.parent_name ILIKE '%' || s.keyword || '%'
   OR d.name ILIKE '%' || s.keyword || '%'
ORDER BY e.employee_no;