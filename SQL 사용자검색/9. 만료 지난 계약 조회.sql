SELECT
    co.name AS 업체명,
    c.name AS 계약명,
    o.name AS 담당부서,
    c.end_date AS 종료일,
    CURRENT_DATE - c.end_date AS 초과일수,
    c.status AS 상태
FROM contracts c
LEFT JOIN companies co ON co.id = c.company_id
LEFT JOIN app.contract_organizations corg ON corg.contract_id = c.id
LEFT JOIN app.organizations o ON o.id = corg.organization_id
WHERE c.status <> 'closed'
  AND c.end_date < CURRENT_DATE
ORDER BY c.end_date;