SELECT
    e.employee_no AS 사원번호,
    e.name AS 이름,
    d.parent_name AS 부서1,
    d.name AS 부서2,
    p.name AS 직급,
    e.employment_status AS 재직상태
FROM app.employee_master e
LEFT JOIN app.employee_departments d ON d.code = e.department_code
LEFT JOIN app.employee_positions p ON p.code = e.position_code
WHERE e.organization_id IS NULL
ORDER BY d.parent_name, d.name, e.employee_no;