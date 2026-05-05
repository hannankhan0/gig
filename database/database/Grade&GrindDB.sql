-- ============================================================
-- grade & grind database
-- foundations of software engineering | spring 2026
-- members: sadeem 24L-2502 | mahnoor 24L-2533 | yousuf 24L-2539
-- ============================================================


use master;
go

if exists (select name from sys.databases where name = 'GradeAndGrindDB')
    drop database GradeAndGrindDB;
go

create database GradeAndGrindDB;
go

use GradeAndGrindDB;
go

-- ============================================================
-- table 1: users
-- all platform users — students, clients, and admins
-- firebase handles authentication — no password or otp columns
-- ============================================================
create table Users
(
    UserID      int            primary key identity(1,1),
    FullName    nvarchar(100)  not null,
    Email       nvarchar(100)  not null unique,
    Phone       nvarchar(20),
    University  nvarchar(100),
    ProfilePic  nvarchar(255),                          -- cloudinary url
    Role        nvarchar(10)   not null default 'student'
                check (Role in ('student', 'client', 'admin')),
    IsVerified  bit            default 0,               -- admin verified account
    IsBanned    bit            default 0,               -- banned from platform
    CreatedAt   datetime       default getdate()
);
go

-- ============================================================
-- table 2: studentprofiles
-- extended profile info for students only
-- one-to-one with users where role = student
-- ============================================================
create table StudentProfiles
(
    ProfileID        int            primary key identity(1,1),
    UserID           int            not null unique
                     foreign key references Users(UserID),
    Bio              nvarchar(500),
    Degree           nvarchar(100),                     -- e.g. bscs, bsds, bsse
    GraduationYear   int,
    CVURL            nvarchar(255),                     -- cloudinary pdf url
    PortfolioURL     nvarchar(255),
    LinkedInURL      nvarchar(255),
    IsAvailable      bit            default 1,          -- 1 = open to new gigs
    IsPublished      bit            default 0,          -- 1 = profile is public
    UpdatedAt        datetime       default getdate()
);
go

-- ============================================================
-- table 3: clientprofiles
-- extended profile info for clients only
-- one-to-one with users where role = client
-- ============================================================
create table ClientProfiles
(
    ClientProfileID  int            primary key identity(1,1),
    UserID           int            not null unique
                     foreign key references Users(UserID),
    CompanyName      nvarchar(100),
    Industry         nvarchar(50),                      -- e.g. tech, marketing, design
    Description      nvarchar(500),
    WebsiteURL       nvarchar(255),
    UpdatedAt        datetime       default getdate()
);
go

-- ============================================================
-- table 4: studentskills
-- skills a student lists on their profile
-- free text — no master skills table needed
-- ============================================================
create table StudentSkills
(
    StudentSkillID   int            primary key identity(1,1),
    UserID           int            not null
                     foreign key references Users(UserID),
    SkillName        nvarchar(50)   not null,
    unique (UserID, SkillName)                          -- no duplicate skills per student
);
go

-- ============================================================
-- table 5: gigs
-- tasks posted by clients for students to apply to
-- depends on: users
-- ============================================================
create table Gigs
(
    GigID            int            primary key identity(1,1),
    ClientID         int            not null
                     foreign key references Users(UserID),
    Title            nvarchar(150)  not null,
    Description      nvarchar(2000),
    Budget           decimal(10,2)  check (Budget >= 0),
    Deadline         date,
    Category         nvarchar(50),                      -- e.g. development, design, writing
    RequiredSkills   nvarchar(500),                     -- comma separated keywords for matching
    Status           nvarchar(20)   default 'open'
                     check (Status in ('open', 'in_progress', 'completed', 'cancelled')),
    CreatedAt        datetime       default getdate()
);
go

-- ============================================================
-- table 6: applications
-- students apply to gigs
-- one student can only apply once per gig
-- depends on: gigs, users
-- ============================================================
create table Applications
(
    ApplicationID    int            primary key identity(1,1),
    GigID            int            not null
                     foreign key references Gigs(GigID),
    StudentID        int            not null
                     foreign key references Users(UserID),
    CoverLetter      nvarchar(1000),
    MatchScore       int            default 0,          -- keyword match % calculated by backend
    Status           nvarchar(20)   default 'pending'
                     check (Status in ('pending', 'accepted', 'rejected', 'withdrawn')),
    AppliedAt        datetime       default getdate(),
    unique (GigID, StudentID)                           -- one application per student per gig
);
go

-- ============================================================
-- table 7: wallets
-- one wallet per user — stores token balance
-- tokens are integers not decimal amounts
-- depends on: users
-- ============================================================
create table Wallets
(
    WalletID         int            primary key identity(1,1),
    UserID           int            not null unique
                     foreign key references Users(UserID),
    TokenBalance     int            default 0
                     check (TokenBalance >= 0),         -- cannot go negative
    UpdatedAt        datetime       default getdate()
);
go

-- ============================================================
-- table 8: transactions
-- every token movement on the platform
-- fromwalletid is null for topups, towalletid is null for withdrawals
-- depends on: wallets, gigs
-- ============================================================
create table Transactions
(
    TransactionID    int            primary key identity(1,1),
    FromWalletID     int
                     foreign key references Wallets(WalletID),
    ToWalletID       int
                     foreign key references Wallets(WalletID),
    GigID            int
                     foreign key references Gigs(GigID),  -- nullable — topups have no gig
    Tokens           int            not null check (Tokens > 0),
    Type             nvarchar(20)   not null
                     check (Type in ('topup', 'payment', 'refund', 'withdrawal')),
    Note             nvarchar(200),                     -- e.g. payment for gig design logo
    CreatedAt        datetime       default getdate()
);
go

-- ============================================================
-- table 9: messages
-- direct chat between student and client
-- tied to a gig context but nullable for general messages
-- a user cannot message themselves
-- depends on: users, gigs
-- ============================================================
create table Messages
(
    MessageID        int            primary key identity(1,1),
    SenderID         int            not null
                     foreign key references Users(UserID),
    ReceiverID       int            not null
                     foreign key references Users(UserID),
    GigID            int
                     foreign key references Gigs(GigID),  -- nullable
    Body             nvarchar(2000) not null,
    IsRead           bit            default 0,
    SentAt           datetime       default getdate(),
    check (SenderID <> ReceiverID)                     -- cannot message yourself
);
go

-- ============================================================
-- table 10: reviews
-- left after a gig is completed
-- both client and student can review each other
-- one review per person per gig
-- depends on: gigs, users
-- ============================================================
create table Reviews
(
    ReviewID         int            primary key identity(1,1),
    GigID            int            not null
                     foreign key references Gigs(GigID),
    ReviewerID       int            not null
                     foreign key references Users(UserID),
    RevieweeID       int            not null
                     foreign key references Users(UserID),
    Rating           tinyint        not null check (Rating between 1 and 5),
    Comment          nvarchar(500),
    CreatedAt        datetime       default getdate(),
    unique (GigID, ReviewerID),                        -- one review per gig per reviewer
    check (ReviewerID <> RevieweeID)                   -- cannot review yourself
);
go

-- ============================================================
-- table 11: notifications
-- in-app alerts for all key events
-- depends on: users
-- ============================================================
create table Notifications
(
    NotificationID   int            primary key identity(1,1),
    UserID           int            not null
                     foreign key references Users(UserID),
    Title            nvarchar(100)  not null,
    Message          nvarchar(300)  not null,
    Type             nvarchar(20)   not null
                     check (Type in ('gig', 'application', 'message',
                            'payment', 'review', 'system')),
    IsRead           bit            default 0,
    CreatedAt        datetime       default getdate()
);
go

-- ============================================================
-- table 12: reports
-- users can report inappropriate gigs or other users
-- admin resolves reports from the admin panel
-- depends on: users, gigs
-- ============================================================
create table Reports
(
    ReportID         int            primary key identity(1,1),
    ReporterID       int            not null
                     foreign key references Users(UserID),
    ReportedUserID   int
                     foreign key references Users(UserID),  -- nullable
    ReportedGigID    int
                     foreign key references Gigs(GigID),    -- nullable
    Reason           nvarchar(500)  not null,
    Status           nvarchar(20)   default 'pending'
                     check (Status in ('pending', 'resolved', 'dismissed')),
    CreatedAt        datetime       default getdate()
);
go


-- ============================================================
-- dummy data
-- inserted in dependency order: parents before children
-- ============================================================

-- users first — all other tables reference userid
insert into Users (FullName, Email, Phone, University, Role, IsVerified) values
('Sadeem Arshad',    'sadeem@gmail.com',    '03001111111', 'FAST-NU Lahore',  'student', 1),
('Mahnoor Fatima',    'mahnoor@gmail.com',   '03002222222', 'FAST-NU Lahore',  'student', 1),
('Yousuf Iqbal',     'yousuf@gmail.com',    '03003333333', 'FAST-NU Lahore',  'student', 1),
('Ali Hassan',       'ali@gmail.com',       '03004444444', 'LUMS',            'student', 0),
('Sara Malik',       'sara@gmail.com',      '03005555555', 'UET Lahore',      'student', 1),
('TechCorp PK',      'techcorp@gmail.com',  '03006666666', null,              'client',  1),
('DesignHub',        'designhub@gmail.com', '03007777777', null,              'client',  1),
('StartupXYZ',       'startup@gmail.com',   '03008888888', null,              'client',  0),
('Admin User',       'admin@gradeandgrind.com', '03009999999', null,          'admin',   1);
go

-- student profiles
insert into StudentProfiles (UserID, Bio, Degree, GraduationYear, IsAvailable, IsPublished) values
(1, 'Full stack developer with a passion for clean code.', 'BSCS', 2026, 1, 1),
(2, 'UI/UX designer and frontend developer.', 'BSDS', 2026, 1, 1),
(3, 'Backend developer skilled in Node.js and SQL.', 'BSCS', 2026, 1, 1),
(4, 'Data science student with Python expertise.', 'BSDS', 2027, 1, 0),
(5, 'Content writer and graphic designer.', 'BBA', 2026, 0, 0);
go

-- client profiles
insert into ClientProfiles (UserID, CompanyName, Industry, Description) values
(6, 'TechCorp Pakistan', 'Technology', 'Software house looking for talented students.'),
(7, 'DesignHub Studio', 'Design', 'Creative agency needing fresh design talent.'),
(8, 'StartupXYZ', 'E-commerce', 'Early stage startup looking for affordable dev help.');
go

-- student skills
insert into StudentSkills (UserID, SkillName) values
(1, 'React'),
(1, 'Node.js'),
(1, 'SQL'),
(2, 'Figma'),
(2, 'React'),
(2, 'CSS'),
(3, 'Node.js'),
(3, 'Express'),
(3, 'SQL Server'),
(4, 'Python'),
(4, 'Machine Learning'),
(4, 'Data Analysis'),
(5, 'Content Writing'),
(5, 'Graphic Design'),
(5, 'Canva');
go

-- gigs posted by clients
insert into Gigs (ClientID, Title, Description, Budget, Deadline, Category, RequiredSkills, Status) values
(6, 'Build a React Dashboard',
    'Need a responsive admin dashboard using React and Tailwind.',
    5000.00, '2026-04-15', 'Development', 'React,JavaScript,Tailwind,CSS', 'open'),

(6, 'Node.js REST API Development',
    'Build a REST API for our inventory management system.',
    8000.00, '2026-04-20', 'Development', 'Node.js,Express,SQL,REST API', 'open'),

(7, 'Logo and Brand Identity Design',
    'Design a modern logo and brand kit for a new startup.',
    3000.00, '2026-04-10', 'Design', 'Figma,Logo Design,Branding,Illustrator', 'in_progress'),

(7, 'UI Design for Mobile App',
    'Create high fidelity screens for an iOS app in Figma.',
    4500.00, '2026-04-25', 'Design', 'Figma,UI Design,Mobile Design', 'open'),

(8, 'Python Data Analysis Script',
    'Write a Python script to analyse sales data and generate charts.',
    2500.00, '2026-04-12', 'Data', 'Python,Pandas,Matplotlib,Data Analysis', 'completed'),

(6, 'Content Writing for Tech Blog',
    'Write 5 articles about software engineering trends.',
    1500.00, '2026-04-08', 'Writing', 'Content Writing,Technical Writing,SEO', 'open');
go

-- wallets — one per user
insert into Wallets (UserID, TokenBalance) values
(1, 50),
(2, 30),
(3, 75),
(4, 20),
(5, 10),
(6, 500),
(7, 300),
(8, 150),
(9, 0);
go

-- applications
insert into Applications (GigID, StudentID, CoverLetter, MatchScore, Status) values
(1, 1, 'I have built multiple React dashboards and am confident I can deliver this.', 90, 'accepted'),
(1, 2, 'I have experience with React and would love to take this on.', 70, 'rejected'),
(2, 3, 'Node.js and SQL are my strongest skills. I can start immediately.', 95, 'accepted'),
(3, 2, 'UI design is my specialty. I use Figma daily.', 85, 'accepted'),
(4, 2, 'I have designed multiple mobile app screens in Figma.', 80, 'pending'),
(5, 4, 'Python and data analysis are my core skills from my coursework.', 92, 'accepted'),
(6, 5, 'I have written technical content for blogs before.', 75, 'pending');
go

-- transactions
insert into Transactions (FromWalletID, ToWalletID, GigID, Tokens, Type, Note) values
(null, 6, null, 500, 'topup',    'initial token top up for techcorp'),
(null, 7, null, 300, 'topup',    'initial token top up for designhub'),
(null, 8, null, 150, 'topup',    'initial token top up for startupxyz'),
(6,    1, 1,    50,  'payment',  'payment for react dashboard gig'),
(6,    3, 2,    80,  'payment',  'payment for node.js api gig'),
(7,    2, 3,    30,  'payment',  'payment for logo design gig'),
(8,    4, 5,    25,  'payment',  'payment for python data analysis gig');
go

-- messages
insert into Messages (SenderID, ReceiverID, GigID, Body) values
(6, 1, 1, 'Hi Sadeem, can you start on the dashboard this week?'),
(1, 6, 1, 'Yes absolutely, I will begin today and share progress by Friday.'),
(7, 2, 3, 'Hi Mahnoor, please check the brand guidelines I emailed you.'),
(2, 7, 3, 'Got it! Will have the first concept ready by tomorrow.'),
(9, 4, null, 'Your account has been verified. Welcome to Grade and Grind!');
go

-- reviews — only for completed gigs
insert into Reviews (GigID, ReviewerID, RevieweeID, Rating, Comment) values
(5, 8, 4, 5, 'Ali delivered excellent analysis scripts. Very professional and fast.'),
(5, 4, 8, 4, 'Clear requirements and prompt payment. Great client to work with.');
go

-- notifications
insert into Notifications (UserID, Title, Message, Type) values
(1, 'Application Accepted',    'Your application for React Dashboard has been accepted!', 'application'),
(3, 'Application Accepted',    'Your application for Node.js API has been accepted!',     'application'),
(2, 'Application Rejected',    'Your application for React Dashboard was not selected.',  'application'),
(2, 'New Gig Match',           'A new UI Design gig matches your skills. Check it out!',  'gig'),
(4, 'Payment Received',        'You received 25 tokens for the data analysis gig.',       'payment'),
(6, 'Gig Application',         'A student applied to your React Dashboard gig.',          'application'),
(1, 'New Message',             'TechCorp sent you a message about the dashboard gig.',    'message');
go

----------------------------------------------------------------------------------------------------------------------

ALTER TABLE Reviews ADD IsFlagged BIT NOT NULL DEFAULT 0;
GO

CREATE VIEW vw_UserRatings AS
SELECT
    RevieweeID                 AS UserID,
    AVG(CAST(Rating AS FLOAT)) AS AverageRating,
    COUNT(*)                   AS TotalReviews
FROM Reviews
WHERE IsFlagged = 0
GROUP BY RevieweeID;
GO


SELECT ReviewID, Comment FROM Reviews ORDER BY ReviewID DESC;

UPDATE Users SET FullName = 'Sadeem Arshad' WHERE UserID = 1;
UPDATE Users SET FullName = 'Mahnoor Fatima' WHERE UserID = 2;
GO