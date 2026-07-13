SELECT
    COUNT(*) AS 전체직원수,
    COUNT(*) FILTER (WHERE employment_status = 'active') AS 재직,
    COUNT(*) FILTER (WHERE employment_status = 'resigned') AS 퇴사,
    COUNT(*) FILTER (WHERE organization_id IS NOT NULL) AS 조직매칭,
    COUNT(*) FILTER (WHERE organization_id IS NULL) AS 조직미매칭
FROM app.employee_master;