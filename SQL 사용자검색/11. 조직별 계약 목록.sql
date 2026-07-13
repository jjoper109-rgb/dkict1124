WITH org_search AS (
    SELECT '인사지원팀'::text AS 조직명
)
SELECT
    o.name AS 담당부서,
    co.name AS 업체명,
    c.name AS 계약명,
    c.start_date AS 시작일,
    c.end_date AS 종료일,
    c.amount AS 계약금액,
    c.status AS 상태
FROM contracts c
JOIN companies co ON co.id = c.company_id
LEFT JOIN app.contract_organizations corg ON corg.contract_id = c.id
LEFT JOIN app.organizations o ON o.id = corg.organization_id
CROSS JOIN org_search s
WHERE o.name ILIKE '%' || s.조직명 || '%'
ORDER BY c.end_date;