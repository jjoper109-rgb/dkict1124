SELECT
    co.name AS 업체명,
    COUNT(c.id) AS 계약수,
    SUM(c.amount) AS 총계약금액,
    ROUND(SUM(c.amount) / 12.0) AS 월환산금액
FROM contracts c
JOIN companies co ON co.id = c.company_id
WHERE c.status = 'active'
GROUP BY co.name
ORDER BY 월환산금액 DESC;