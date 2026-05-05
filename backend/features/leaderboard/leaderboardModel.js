// features/leaderboard/leaderboardModel.js
// US-14 — Student Leaderboard
// Formula: (AvgRating × 0.4) + (CompletedGigs × 0.3) + (SuccessRate × 0.3)
// Minimum 5 completed gigs to appear. Top 100 students shown.
//
// Schema notes (actual DB):
//   University  → Users.University       (NOT StudentProfiles)
//   Skills      → StudentSkills table    (NOT a column on StudentProfiles)

const { sql, poolPromise } = require('../../config/db');

/**
 * Fetch the ranked leaderboard.
 * @param {string|null} university  - filter by Users.University
 * @param {string|null} skill       - filter by StudentSkills.SkillName
 */
const getLeaderboard = async (university = null, skill = null) => {
  const pool = await poolPromise;
  const req  = pool.request();

  if (university) req.input('university', sql.NVarChar, university);
  if (skill)      req.input('skill',      sql.NVarChar, skill);

  const result = await req.query(`
    WITH GigStats AS (
      SELECT
        a.StudentID,
        COUNT(CASE WHEN g.Status = 'completed' THEN 1 END) AS CompletedGigs,
        COUNT(a.ApplicationID)                              AS TotalAssigned
      FROM Applications a
      JOIN Gigs g ON g.GigID = a.GigID
      WHERE a.Status = 'accepted'
      GROUP BY a.StudentID
    ),
    ReviewStats AS (
      SELECT
        RevieweeID                        AS StudentID,
        AVG(CAST(Rating AS FLOAT))        AS AvgRating,
        COUNT(*)                          AS TotalReviews
      FROM Reviews
      WHERE IsFlagged = 0
      GROUP BY RevieweeID
    ),
    Ranked AS (
      SELECT
        u.UserID,
        u.FullName,
        u.ProfilePic,
        u.University,                                           -- University lives on Users
        COALESCE(gs.CompletedGigs, 0)                       AS CompletedGigs,
        COALESCE(gs.TotalAssigned, 0)                       AS TotalAssigned,
        COALESCE(rs.AvgRating,    0)                        AS AvgRating,
        COALESCE(rs.TotalReviews, 0)                        AS TotalReviews,
        CASE
          WHEN COALESCE(gs.TotalAssigned, 0) = 0 THEN 0
          ELSE CAST(gs.CompletedGigs AS FLOAT) / gs.TotalAssigned * 100
        END AS SuccessRate,
        (
          COALESCE(rs.AvgRating,    0) * 0.4 +
          COALESCE(gs.CompletedGigs,0) * 0.3 +
          CASE
            WHEN COALESCE(gs.TotalAssigned, 0) = 0 THEN 0
            ELSE (CAST(gs.CompletedGigs AS FLOAT) / gs.TotalAssigned) * 0.3
          END
        ) AS Score
      FROM Users u
      LEFT JOIN StudentProfiles sp ON sp.UserID = u.UserID
      LEFT JOIN GigStats         gs ON gs.StudentID = u.UserID
      LEFT JOIN ReviewStats       rs ON rs.StudentID = u.UserID
      WHERE u.Role = 'student'
        AND COALESCE(gs.CompletedGigs, 0) >= 5
        ${university ? 'AND u.University = @university' : ''}
        ${skill      ? 'AND EXISTS (SELECT 1 FROM StudentSkills sk WHERE sk.UserID = u.UserID AND sk.SkillName = @skill)' : ''}
    )
    SELECT TOP 100
      ROW_NUMBER() OVER (ORDER BY Score DESC) AS Rank,
      UserID,
      FullName,
      ProfilePic,
      University,
      CompletedGigs,
      TotalReviews,
      ROUND(AvgRating,   2) AS AvgRating,
      ROUND(SuccessRate, 1) AS SuccessRate,
      ROUND(Score,       4) AS Score
    FROM Ranked
    ORDER BY Score DESC
  `);

  return result.recordset;
};

/**
 * Get the current student's rank across all qualified students.
 * Returns null if under 5 completed gigs.
 */
const getMyRank = async (studentID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('studentID', sql.Int, studentID)
    .query(`
      WITH GigStats AS (
        SELECT
          a.StudentID,
          COUNT(CASE WHEN g.Status = 'completed' THEN 1 END) AS CompletedGigs,
          COUNT(a.ApplicationID)                              AS TotalAssigned
        FROM Applications a
        JOIN Gigs g ON g.GigID = a.GigID
        WHERE a.Status = 'accepted'
        GROUP BY a.StudentID
      ),
      ReviewStats AS (
        SELECT
          RevieweeID                      AS StudentID,
          AVG(CAST(Rating AS FLOAT))      AS AvgRating,
          COUNT(*)                        AS TotalReviews
        FROM Reviews
        WHERE IsFlagged = 0
        GROUP BY RevieweeID
      ),
      AllStudents AS (
        SELECT
          u.UserID,
          COALESCE(gs.CompletedGigs, 0) AS CompletedGigs,
          COALESCE(rs.AvgRating,    0)  AS AvgRating,
          COALESCE(rs.TotalReviews, 0)  AS TotalReviews,
          CASE
            WHEN COALESCE(gs.TotalAssigned, 0) = 0 THEN 0
            ELSE CAST(gs.CompletedGigs AS FLOAT) / gs.TotalAssigned * 100
          END AS SuccessRate,
          (
            COALESCE(rs.AvgRating,    0) * 0.4 +
            COALESCE(gs.CompletedGigs,0) * 0.3 +
            CASE
              WHEN COALESCE(gs.TotalAssigned, 0) = 0 THEN 0
              ELSE (CAST(gs.CompletedGigs AS FLOAT) / gs.TotalAssigned) * 0.3
            END
          ) AS Score
        FROM Users u
        LEFT JOIN GigStats    gs ON gs.StudentID = u.UserID
        LEFT JOIN ReviewStats rs ON rs.StudentID = u.UserID
        WHERE u.Role = 'student'
          AND COALESCE(gs.CompletedGigs, 0) >= 5
      )
      SELECT
        ROW_NUMBER() OVER (ORDER BY Score DESC) AS Rank,
        UserID,
        CompletedGigs,
        TotalReviews,
        ROUND(AvgRating,   2) AS AvgRating,
        ROUND(SuccessRate, 1) AS SuccessRate,
        ROUND(Score,       4) AS Score
      FROM AllStudents
    `);

  return result.recordset.find(r => r.UserID === studentID) ?? null;
};

/**
 * Distinct universities for the filter dropdown — from Users table.
 */
const getUniversities = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT DISTINCT University
    FROM Users
    WHERE Role = 'student'
      AND University IS NOT NULL
      AND University <> ''
    ORDER BY University
  `);
  return result.recordset.map(r => r.University);
};

module.exports = { getLeaderboard, getMyRank, getUniversities };