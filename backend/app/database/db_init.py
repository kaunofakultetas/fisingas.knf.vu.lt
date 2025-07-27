############################################################
# Author:           Tomas Vanagas
# Updated:          2025-07-27
# Version:          1.0
# Description:      Database initialization
############################################################


from .db import get_db_connection





def init_db():
    init_db_views()
    init_db_tables()
    init_db_indexes()

    init_default_admin_user()
    init_default_settings()





def init_db_views():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE VIEW IF NOT EXISTS _VIEW_GetUsersAnswers (
                StudentID,
                UserName,
                QuestionID,
                QuestionText,
                Answer,
                IsPhishing,
                IsAnswerCorrect,
                
                TotalOptionsCount,
                CorrectOptionsCount,
                IsAllAnswerOptionsCorrect,
                CorrectOptionsPercentage,
                AnswerPoints
            ) AS

            WITH GetAnswerResults AS (
                SELECT
                    *,
                    IIF(Answer = IsPhishing, 1, 0) AS IsAnswerCorrect
                FROM (
                    SELECT
                        PhishingTest_Answers.StudentID				AS StudentID,
                        Users_Students.Username							AS Username,
                        PhishingTest_Answers.QuestionID			AS QuestionID,
                        PhishingTest_Answers.AnswerStatus		AS Answer,
                        PhishingTest_Questions.IsPhishing			AS IsPhishing,
                        PhishingTest_Questions.Question				AS QuestionText
                    FROM
                        PhishingTest_Answers
                    LEFT JOIN PhishingTest_Questions
                        ON PhishingTest_Answers.QuestionID = PhishingTest_Questions.QuestionID
                    LEFT JOIN Users_Students
                        ON Users_Students.StudentID = PhishingTest_Answers.StudentID
                )
            ),
            GetUsersAnswersOptionsResults AS (
                SELECT
                    *,
                    IIF(TotalOptionsCount = CorrectOptionsCount, 1, 0) 				AS IsAllAnswerOptionsCorrect,
                    (CorrectOptionsCount * 1.0 / TotalOptionsCount) * 100.0 		AS CorrectOptionsPercentage
                FROM (
                    SELECT
                        _VIEW_GetUsersAnswersOptions.StudentID		AS StudentID,
                        _VIEW_GetUsersAnswersOptions.Username		AS Username,
                        _VIEW_GetUsersAnswersOptions.QuestionID  	AS QuestionID,
                        COUNT(*)																			AS TotalOptionsCount,
                        SUM(IsAnswerOptionCorrectlySelected) 				AS CorrectOptionsCount
                    FROM
                        _VIEW_GetUsersAnswersOptions
                    WHERE 
                        QuestionID  IN (SELECT QuestionID FROM PhishingTest_Questions)
                    GROUP BY StudentID, QuestionID
                )
            )


            SELECT
                GetAnswerResults.StudentID																	AS UserID,
                GetAnswerResults.Username																	AS Username,
                GetAnswerResults.QuestionID																	AS QuestionID,
                GetAnswerResults.QuestionText																AS QuestionText,
                GetAnswerResults.Answer																		AS Answer,
                GetAnswerResults.IsPhishing																	AS IsPhishing,
                GetAnswerResults.IsAnswerCorrect														AS IsAnswerCorrect,
                
                
                GetUsersAnswersOptionsResults.TotalOptionsCount						AS TotalOptionsCount,
                GetUsersAnswersOptionsResults.CorrectOptionsCount					AS CorrectOptionsCount,
                GetUsersAnswersOptionsResults.IsAllAnswerOptionsCorrect		AS IsAllAnswerOptionsCorrect,
                GetUsersAnswersOptionsResults.CorrectOptionsPercentage			AS CorrectOptionsPercentage,
                PRINTF('%.2f', IIF(GetAnswerResults.IsAnswerCorrect = 1, 1 - GetUsersAnswersOptionsResults.TotalOptionsCount *0.1 + GetUsersAnswersOptionsResults.CorrectOptionsCount * 0.1,   0)) 		AS AnswerPoints
            FROM
                GetAnswerResults
            LEFT JOIN GetUsersAnswersOptionsResults
                ON 	GetAnswerResults.StudentID 		= 	GetUsersAnswersOptionsResults.StudentID 		AND
                            GetAnswerResults.QuestionID 		= 	GetUsersAnswersOptionsResults.QuestionID
            WHERE 
                GetAnswerResults.StudentID IN (SELECT StudentID FROM Users_Students)
        ''')
        conn.execute('''
            CREATE VIEW IF NOT EXISTS _VIEW_GetUsersAnswersOptions (
                StudentID,
                Username,
                QuestionID,
                QuestionOptionID,
                QuestionOptionText,
                RightAnswerOption,
                SelectedAnswerOption,
                IsAnswerOptionCorrectlySelected
            ) AS
            
            SELECT
                StudentID,
                Username,
                QuestionID,
                QuestionOptionID,
                QuestionOptionText,
                RightAnswerOption,
                SelectedAnswerOption,
                IIF(RightAnswerOption = SelectedAnswerOption, 1, 0)							AS IsAnswerOptionCorrectlySelected
            FROM (
                SELECT
                    Users_Students.StudentID 																									AS StudentID,
                    Users_Students.Username																									AS Username,
                    PhishingTest_Answers.QuestionID																					AS QuestionID,
                    PhishingTest_QuestionsOptions.QuestionOptionID														AS QuestionOptionID,
                    PhishingTest_QuestionsOptions.QuestionOptionText													AS QuestionOptionText,
                    PhishingTest_QuestionsOptions.AnswerStatus															AS RightAnswerOption,
                    IFNULL(PhishingTest_AnswersSelectedOptions.IsSelected, 0) 							AS SelectedAnswerOption
                FROM
                    Users_Students
                    
                -- JOIN Table to get what answers do student had to answer
                LEFT JOIN PhishingTest_Answers
                    ON		PhishingTest_Answers.StudentID = Users_Students.StudentID
                    
                -- JOIN Table to get all options of the student questions that exist
                LEFT JOIN PhishingTest_QuestionsOptions
                    ON 	PhishingTest_QuestionsOptions.QuestionID = PhishingTest_Answers.QuestionID
                    
                -- JOIN Table to get all options that user has selected
                LEFT JOIN PhishingTest_AnswersSelectedOptions
                    ON 	PhishingTest_AnswersSelectedOptions.StudentID = Users_Students.StudentID AND
                                PhishingTest_AnswersSelectedOptions.QuestionID = PhishingTest_QuestionsOptions.QuestionID AND
                                PhishingTest_AnswersSelectedOptions.QuestionOptionID = PhishingTest_QuestionsOptions.QuestionOptionID
            )
        ''')
        conn.execute('''
            CREATE VIEW IF NOT EXISTS _VIEW_GetUsersTestResults (
                StudentID,
                Username,
                QuestionCount,
                FullyCorrectCount,
                FullyCorrectPercentage,
                TestGrade,
                TotalIdentifiedCorrectly,
                TotalOptionsCount,
                TotalCorrectOptionsCount
            ) AS

            SELECT 
                StudentID,
                Username,
                QuestionCount,
                FullyCorrectCount,
                CAST((FullyCorrectCount * 1.0 / QuestionCount) * 100 AS INTEGER) 		AS PercentageCorrect,
                PRINTF('%.2f', ROUND((TotalAnswerPoints / QuestionCount * 10), 2)) 	AS TestGrade,
                TotalIdentifiedCorrectly																									AS TotalIdentifiedCorrectly,
                TotalOptionsCount																											AS TotalOptionsCount,
                TotalCorrectOptionsCount																								AS TotalCorrectOptionsCount
            FROM (
                SELECT
                    StudentID,
                    Username,
                    COUNT(*)										AS QuestionCount,
                    SUM(IsQuestionFullyCorrect) 	AS FullyCorrectCount,
                    SUM(AnswerPoints)					AS TotalAnswerPoints,
                    SUM(IsAnswerCorrect)				AS TotalIdentifiedCorrectly,
                    SUM(OptionsCount)					AS TotalOptionsCount,
                    SUM(CorrectOptionsCount)		AS TotalCorrectOptionsCount
                FROM (
                    SELECT
                        StudentID,
                        Username,
                        QuestionID,
                        IsAnswerCorrect,
                        IsAllAnswerOptionsCorrect,
                        IIF(IsAnswerCorrect = 1 AND IsAllAnswerOptionsCorrect = 1, 1, 0) 								AS IsQuestionFullyCorrect,
                        IIF(IsAnswerCorrect = 1, 1 - OptionsCount*0.1 + CorrectOptionsCount*0.1,   0) 		AS AnswerPoints,
                        OptionsCount																																		AS OptionsCount,
                        CorrectOptionsCount																														AS CorrectOptionsCount
                    FROM (
                        SELECT
                            Users_Students.StudentID																			AS StudentID,
                            Users_Students.Username															AS Username,
                            _VIEW_GetUsersAnswers.QuestionID										AS QuestionID,
                            _VIEW_GetUsersAnswers.IsAnswerCorrect							AS IsAnswerCorrect,
                            _VIEW_GetUsersAnswers.IsAllAnswerOptionsCorrect		AS IsAllAnswerOptionsCorrect,
                            _VIEW_GetUsersAnswers.TotalOptionsCount						AS OptionsCount,
                            _VIEW_GetUsersAnswers.CorrectOptionsCount					AS CorrectOptionsCount
                        FROM
                            Users_Students
                        LEFT JOIN _VIEW_GetUsersAnswers
                            ON Users_Students.StudentID = _VIEW_GetUsersAnswers.StudentID
                        WHERE
                            QuestionID IS NOT NULL
                        GROUP BY Users_Students.StudentID, _VIEW_GetUsersAnswers.QuestionID
                    )
                    GROUP BY StudentID, QuestionID
                )
                GROUP BY StudentID
            )
        ''')




def init_db_tables():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "PhishingTest_Answers" (
                "StudentID"	INTEGER NOT NULL,
                "QuestionID"	INTEGER NOT NULL,
                "AnswerStatus"	INTEGER,
                UNIQUE("StudentID","QuestionID")
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "PhishingTest_AnswersSelectedOptions" (
                "StudentID"	INTEGER NOT NULL,
                "QuestionID"	INTEGER NOT NULL,
                "QuestionOptionID"	INTEGER NOT NULL,
                "IsSelected"	INTEGER,
                UNIQUE("StudentID","QuestionID","QuestionOptionID")
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "PhishingTest_Questions" (
                "QuestionID"	INTEGER NOT NULL UNIQUE,
                "IsEnabled"	INTEGER NOT NULL,
                "Points"	INTEGER NOT NULL,
                "IsPhishing"	INTEGER NOT NULL,
                "Question"	TEXT NOT NULL,
                "Filename"	TEXT NOT NULL,
                "Picture"	BLOB NOT NULL,
                "PictureHeight"	INTEGER NOT NULL,
                "PictureWidth"	INTEGER NOT NULL,
                "Created"	TEXT NOT NULL,
                PRIMARY KEY("QuestionID" AUTOINCREMENT)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "PhishingTest_QuestionsLinks" (
                "QuestionLinkID"	INTEGER NOT NULL UNIQUE,
                "QuestionID"	INTEGER NOT NULL,
                "Title"	TEXT NOT NULL,
                "Content"	TEXT NOT NULL,
                "X"	TEXT NOT NULL,
                "Y"	TEXT NOT NULL, [W] TEXT NULL, [H] TEXT NULL,
                PRIMARY KEY("QuestionLinkID" AUTOINCREMENT)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "PhishingTest_QuestionsOptions" (
                "QuestionOptionID"	INTEGER NOT NULL UNIQUE,
                "QuestionID"	INTEGER NOT NULL,
                "QuestionOptionText"	TEXT NOT NULL,
                "AnswerStatus"	INTEGER NOT NULL,
                PRIMARY KEY("QuestionOptionID" AUTOINCREMENT)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "System_Settings" (
                "Name"	TEXT NOT NULL UNIQUE,
                "Value"	TEXT NOT NULL,
                PRIMARY KEY("Name")
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "System_Users" (
                "ID"	INTEGER NOT NULL UNIQUE,
                "Email"	TEXT NOT NULL,
                "Password"	TEXT NOT NULL,
                "Admin"	INTEGER NOT NULL DEFAULT 1,
                "Enabled"	INTEGER NOT NULL DEFAULT 0,
                "LastLogin"	TEXT NOT NULL DEFAULT '',
                CONSTRAINT "sqlite_autoindex_Users_Administrators_2" UNIQUE("Email"),
                PRIMARY KEY("ID" AUTOINCREMENT)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "Users_StudentGroups" (
                "GroupID"	INTEGER NOT NULL UNIQUE,
                "Name"	TEXT NOT NULL,
                "Description"	TEXT NOT NULL,
                "ShowAnswers"	INTEGER NOT NULL DEFAULT 0,
                "TimeLimit"	INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY("GroupID" AUTOINCREMENT)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS "Users_Students" (
                "StudentID"	INTEGER NOT NULL UNIQUE,
                "GroupID"	INTEGER NOT NULL DEFAULT 0,
                "Username"	TEXT NOT NULL,
                "Passcode"	TEXT NOT NULL,
                "IsFinished"	INTEGER NOT NULL DEFAULT 0,
                "LastLogin"	TEXT NOT NULL,
                "Status"	INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY("StudentID" AUTOINCREMENT)
            )
        ''')
            



def init_db_indexes():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE INDEX IF NOT EXISTS "INDEX_PhishingTest_Answers" ON "PhishingTest_Answers" (
                "StudentID",
                "QuestionID"
            )
        ''')
        conn.execute('''
            CREATE INDEX IF NOT EXISTS "INDEX_PhishingTest_AnswersSelectedOptions" ON "PhishingTest_AnswersSelectedOptions" (
                "StudentID",
                "QuestionID"
            )
        ''')
        conn.execute('''
            CREATE INDEX IF NOT EXISTS "INDEX_Users_Students" ON "Users_Students" (
                "StudentID"
            )
        ''')




def init_default_admin_user():
    with get_db_connection() as conn:
        sqlFetchData = conn.execute(''' SELECT COUNT(*) FROM System_Users ''')

        if(sqlFetchData.fetchone()[0] == 0):
            # Email: admin@admin.com
            # Pass: admin
            conn.execute(''' INSERT INTO System_Users (Email, Password, Admin, Enabled) VALUES (?,?,?,?) ''', ['admin@admin.com', '$2a$12$4a3b6u7a1oBdtvuTkvw9TevgCwH36raEE2oe1BI9Wtt7.L4Pfb4YW', 1, 1])
            conn.commit()




def init_default_settings():
    with get_db_connection() as conn:
        conn.execute(''' INSERT OR IGNORE INTO System_Settings (Name, Value) VALUES (?,?) ''', ['PhishingTestSize', '9'])

