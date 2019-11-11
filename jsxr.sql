SELECT * FROM JSXR.season WHERE id = 4651;
SELECT * FROM JSXR.players;
SELECT * FROM JSXR.season;

DELETE FROM JSXR.players;

DESCRIBE JSXR.season;

SELECT s.id, s.pts_ppr, p.name, s.pts_ppr/s.gms_active AS avg_points FROM JSXR.season s INNER JOIN JSXR.players p ON s.id = p.id ORDER BY avg_points DESC;

SELECT s.id, p.name, p.team FROM JSXR.season s INNER JOIN JSXR.players p ON s.id = p.id WHERE gp = 9;