SELECT
    p.id,
    co.name AS 업체명,
    p.title AS 제목,
    p.status AS 상태,
    p.due_date AS 처리기한,
    p.memo AS 비고,
    p.created_at AS 등록일
FROM app.pending_items p
LEFT JOIN companies co ON co.id = p.company_id
WHERE p.status <> 'done'
ORDER BY p.due_date NULLS LAST, p.created_at DESC;