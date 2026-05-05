-- ============================================================
-- Grade & Grind — Leaderboard Dummy Data

USE GradeAndGrindDB;
GO

-- STEP 1: Add extra gigs (clients 6,7,8 posting)

INSERT INTO Gigs (ClientID, Title, Description, Budget, Deadline, Category, RequiredSkills, Status) VALUES

-- Gigs for Sadeem (UserID=1) to complete
(6, 'Landing Page Design',         'Build a modern landing page in React.',          4000, '2026-03-01', 'Development', 'React,CSS,JavaScript',   'completed'),
(7, 'REST API with Node',          'CRUD API with authentication middleware.',        6000, '2026-03-05', 'Development', 'Node.js,Express,SQL',    'completed'),
(8, 'Dashboard UI',                'Admin dashboard with charts and tables.',        5500, '2026-03-10', 'Development', 'React,Tailwind,JavaScript','completed'),
(6, 'Database Schema Design',      'Design normalized schema for e-commerce app.',   3000, '2026-03-15', 'Development', 'SQL,Database',            'completed'),
(7, 'Bug Fixes React App',         'Fix reported bugs in existing React codebase.',  2500, '2026-03-20', 'Development', 'React,JavaScript',        'completed'),
(8, 'Portfolio Website',           'Personal portfolio with animations.',            3500, '2026-03-25', 'Development', 'HTML,CSS,JavaScript',     'completed'),

-- Gigs for Mahnoor (UserID=2) to complete
(6, 'Figma Mobile App Design',     'Design 10 screens for a food delivery app.',     4500, '2026-03-02', 'Design',      'Figma,UI/UX',             'completed'),
(7, 'Brand Identity Kit',          'Logo, colors, typography for a startup.',        5000, '2026-03-07', 'Design',      'Figma,Illustrator',       'completed'),
(8, 'Website Redesign Mockups',    'Redesign 5 pages of existing website in Figma.', 3500,'2026-03-12', 'Design',      'Figma,UI/UX',             'completed'),
(6, 'Icon Set Design',             '30 custom icons for a mobile app.',              2000, '2026-03-17', 'Design',      'Figma,Illustration',      'completed'),
(7, 'Presentation Design',         'Professional pitch deck — 15 slides.',           2500, '2026-03-22', 'Design',      'Figma,PowerPoint',        'completed'),

-- Gigs for Yousuf (UserID=3) to complete
(6, 'Python Data Script',          'Parse and clean CSV files, export to Excel.',    3000, '2026-03-03', 'Development', 'Python,Pandas',           'completed'),
(7, 'Node.js Email Service',       'Email notification service with templates.',     4000, '2026-03-08', 'Development', 'Node.js,Nodemailer',      'completed'),
(8, 'SQL Query Optimisation',      'Optimise slow queries on existing database.',    3500, '2026-03-13', 'Development', 'SQL,Database',            'completed'),
(6, 'Web Scraper',                 'Scrape product prices from 3 websites daily.',   4500, '2026-03-18', 'Development', 'Python,BeautifulSoup',    'completed'),
(7, 'Express.js Middleware',       'Auth and logging middleware for REST API.',      3000, '2026-03-23', 'Development', 'Node.js,Express',         'completed'),

-- Gigs for Ali Hassan (UserID=4) to complete
(6, 'Data Analysis Report',        'Analyse sales data and produce visualisations.', 5000, '2026-03-04', 'Data',        'Python,Pandas,Matplotlib','completed'),
(7, 'ML Model — Classification',   'Train a simple classifier on provided dataset.', 7000, '2026-03-09', 'Data',        'Python,Scikit-learn',     'completed'),
(8, 'Excel Dashboard',             'Interactive Excel dashboard with pivot tables.', 2500, '2026-03-14', 'Data',        'Excel,Data Analysis',     'completed'),
(6, 'Power BI Report',             '3-page Power BI report from raw data.',          4000, '2026-03-19', 'Data',        'PowerBI,Data',            'completed'),
(7, 'Database Migration Script',   'Migrate MySQL data to PostgreSQL safely.',       3500, '2026-03-24', 'Data',        'SQL,Python',              'completed'),

-- Gigs for Sara Malik (UserID=5) to complete
(6, 'Blog Content Writing',        'Write 10 SEO-optimised blog posts.',             3000, '2026-03-05', 'Writing',     'Content Writing,SEO',     'completed'),
(7, 'Social Media Copy',           '30 days of social media captions and hashtags.', 2500,'2026-03-10', 'Writing',     'Copywriting,Social Media','completed'),
(8, 'Technical Documentation',     'Write API docs for a Node.js REST API.',         3500, '2026-03-15', 'Writing',     'Technical Writing',       'completed'),
(6, 'Product Descriptions',        '50 e-commerce product descriptions.',            2000, '2026-03-20', 'Writing',     'Copywriting,SEO',         'completed'),
(7, 'Newsletter Campaign',         'Write 4-email welcome sequence for SaaS.',       3000, '2026-03-25', 'Writing',     'Email Marketing,Writing', 'completed');
GO

-- STEP 2: Accept applications (one per gig, matching student)
-- GigIDs above are assigned sequentially after existing gigs.
-- Existing gigs in DB: 1-5 already exist, so new ones start at 6.

INSERT INTO Applications (GigID, StudentID, CoverLetter, MatchScore, Status) VALUES
-- Sadeem's gigs (GigIDs 6-11)
(6,  1, 'I can build this landing page cleanly in React.',            88, 'accepted'),
(7,  1, 'REST APIs with auth are my bread and butter.',               92, 'accepted'),
(8,  1, 'Admin dashboards are something I have built before.',        90, 'accepted'),
(9,  1, 'Database design is a core skill I have developed at FAST.',  85, 'accepted'),
(10, 1, 'Happy to dig into the bug fixes, React is my main stack.',   80, 'accepted'),
(11, 1, 'I will build a clean animated portfolio site.',              83, 'accepted'),

-- Mahnoor's gigs (GigIDs 12-16)
(12, 2, 'Figma is my primary tool — I can deliver 10 screens.',      91, 'accepted'),
(13, 2, 'I have done brand identity work for 3 startups.',            87, 'accepted'),
(14, 2, 'I will redesign the 5 pages with a fresh modern look.',      89, 'accepted'),
(15, 2, 'Custom icon sets are something I enjoy creating.',           84, 'accepted'),
(16, 2, 'I design sharp pitch decks that tell a clear story.',        82, 'accepted'),

-- Yousuf's gigs (GigIDs 17-21)
(17, 3, 'Python and Pandas — this is exactly what I do daily.',       94, 'accepted'),
(18, 3, 'I have built email services with Nodemailer before.',        88, 'accepted'),
(19, 3, 'Query optimisation through indexing and rewrites.',          86, 'accepted'),
(20, 3, 'I will build a robust scraper with retry logic.',            90, 'accepted'),
(21, 3, 'Auth and logging middleware — straightforward for me.',      85, 'accepted'),

-- Ali's gigs (GigIDs 22-26)
(22, 4, 'Data analysis with visualisations is my speciality.',        93, 'accepted'),
(23, 4, 'I have trained classifiers on tabular data before.',         89, 'accepted'),
(24, 4, 'Excel pivot dashboards — done this multiple times.',         81, 'accepted'),
(25, 4, 'Power BI reports with drill-through and slicers.',           87, 'accepted'),
(26, 4, 'I will write and test the migration scripts carefully.',     84, 'accepted'),

-- Sara's gigs (GigIDs 27-31)
(27, 5, 'SEO blog writing is my primary freelance skill.',            90, 'accepted'),
(28, 5, 'I write engaging social copy that drives interaction.',      86, 'accepted'),
(29, 5, 'Technical API docs — I write clearly for developers.',       88, 'accepted'),
(30, 5, 'Product descriptions that convert — my strength.',          83, 'accepted'),
(31, 5, 'Welcome email sequences with strong open rates.',            85, 'accepted');
GO

-- STEP 3: Reviews for each completed gig 
-- Reviewer = client who posted gig, Reviewee = student who did it
-- IsFlagged = 0 (clean reviews)

INSERT INTO Reviews (GigID, ReviewerID, RevieweeID, Rating, Comment, IsFlagged) VALUES
-- Sadeem (UserID=1) — avg rating will be ~4.5
(6,  6, 1, 5, 'Delivered a pixel-perfect landing page ahead of schedule. Highly recommend.',   0),
(7,  7, 1, 5, 'API was clean, well-documented and passed all our tests first try.',            0),
(8,  8, 1, 4, 'Great dashboard, minor UI tweaks needed but overall very solid work.',          0),
(9,  6, 1, 4, 'Schema was well thought out. Would have liked more comments in the SQL.',       0),
(10, 7, 1, 5, 'Fixed all bugs quickly and explained each one. Excellent communicator.',        0),
(11, 8, 1, 4, 'Portfolio looks great. Animations are smooth. Delivered on time.',              0),

-- Mahnoor (UserID=2) — avg rating will be ~4.6
(12, 6, 2, 5, 'The app screens were beautiful. Clients loved the design immediately.',         0),
(13, 7, 2, 5, 'Brand identity exceeded expectations. Very creative and professional.',         0),
(14, 8, 2, 5, 'Redesign was exactly what we needed. Fresh and modern.',                       0),
(15, 6, 2, 4, 'Icons are clean and consistent. A couple needed minor adjustments.',            0),
(16, 7, 2, 4, 'Pitch deck looks professional. Delivered 2 days early.',                       0),

-- Yousuf (UserID=3) — avg rating will be ~4.4
(17, 6, 3, 5, 'Script ran perfectly on first try. Saved us hours of manual work.',            0),
(18, 7, 3, 4, 'Email service works well. Template customisation was slightly limited.',        0),
(19, 8, 3, 5, 'Query times dropped by 80%. Excellent analysis and documentation.',            0),
(20, 6, 3, 4, 'Scraper works reliably. Occasional rate-limit issues but handled gracefully.', 0),
(21, 7, 3, 4, 'Middleware is clean and well-structured. Good error handling.',                0),

-- Ali (UserID=4) — avg rating will be ~4.3
(22, 6, 4, 5, 'Analysis was thorough with great visualisations. Presented findings well.',    0),
(23, 7, 4, 4, 'Model accuracy was good. Would have liked more hyperparameter tuning.',        0),
(24, 8, 4, 4, 'Excel dashboard is functional and easy to use. Minor formatting issues.',      0),
(25, 6, 4, 5, 'Power BI report is exactly what we needed for our board meeting.',             0),
(26, 7, 4, 3, 'Migration worked but took longer than estimated. Data was intact though.',     0),

-- Sara (UserID=5) — avg rating will be ~4.2
(27, 6, 5, 5, 'Blog posts were engaging and well-optimised. Traffic increased noticeably.',   0),
(28, 7, 5, 4, 'Social copy was creative. A few captions felt slightly off-brand.',            0),
(29, 8, 5, 4, 'Docs are clear and accurate. Could use more code examples.',                   0),
(30, 6, 5, 4, 'Product descriptions are persuasive and keyword-rich.',                        0),
(31, 7, 5, 4, 'Email sequence reads naturally. Open rate tracking not included as expected.', 0);
GO

-- Verify leaderboard will populate
-- Run this SELECT to confirm data looks right before hitting the API:

SELECT
  u.FullName,
  u.University,
  COUNT(CASE WHEN g.Status = 'completed' THEN 1 END) AS CompletedGigs,
  AVG(CAST(r.Rating AS FLOAT))                        AS AvgRating
FROM Users u
JOIN Applications a  ON a.StudentID = u.UserID AND a.Status = 'accepted'
JOIN Gigs g          ON g.GigID = a.GigID
LEFT JOIN Reviews r  ON r.RevieweeID = u.UserID
WHERE u.Role = 'student'
GROUP BY u.UserID, u.FullName, u.University
HAVING COUNT(CASE WHEN g.Status = 'completed' THEN 1 END) >= 5
ORDER BY AvgRating DESC;
GO