SELECT
    co.name AS 업체명,
    c.name AS 계약명,
    o.name AS 담당부서,
    c.start_date AS 시작일,
    c.end_date AS 종료일,
    c.renewal_date AS 갱신예정일,
    c.amount AS 계약금액,
    c.status AS 상태,
    c.end_date - CURRENT_DATE AS 남은일수
FROM contracts c
LEFT JOIN companies co ON co.id = c.company_id
LEFT JOIN app.contract_organizations corg ON corg.contract_id = c.id
LEFT JOIN app.organizations o ON o.id = corg.organization_id
WHERE c.status <> 'closed'
  AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
ORDER BY c.end_date, co.name;