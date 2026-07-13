SELECT
    COALESCE(o.name, '조직 미매칭') AS 조직,
    COUNT(*) AS 직원수
FROM app.employee_master e
LEFT JOIN app.organizations o ON o.id = e.organization_id
GROUP BY COALESCE(o.name, '조직 미매칭')
ORDER BY 직원수 DESC;