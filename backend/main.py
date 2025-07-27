import bz2
import sqlite3
import hashlib
import json
import socket
import time
import sys
import os
import ipaddress
import base64
from datetime import datetime, date, timedelta
import bcrypt
import random
import re
from functools import wraps


from decimal import Decimal


from flask import Flask, request, jsonify, make_response, Response, redirect, send_file, session
from flask_login import (LoginManager, UserMixin, current_user, login_required, login_user, logout_user)
from flask_restful import Resource, Api
from flask_cors import CORS

from werkzeug.utils import secure_filename


# from flask_socketio import SocketIO




# Flask vars
APP_DEBUG = os.getenv('APP_DEBUG', 'false').lower() == "true"
app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
app.secret_key = b'b826fd9844c136d9da9d00670c67150b6eb37690e703a030e40ac903f13317df'







################# UTILS #################
con = sqlite3.connect(os.getenv('DB_PATH'), check_same_thread=False)
#con.text_factory = lambda x: unicode(x, 'utf-8', 'ignore')
cur = con.cursor()


def get_db_connection():
    conn = sqlite3.connect(os.getenv('DB_PATH'))
    conn.row_factory = sqlite3.Row
    return conn


def timestamp_to_datetime_string(timestamp):
    dt_object = datetime.datetime.fromtimestamp(timestamp)
    datetime_string = dt_object.strftime('%Y-%m-%d %H:%M:%S')
    return datetime_string

#########################################












################# FLASK AUTH #################
login_manager = LoginManager()
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, username, password, userid, admin):
         self.id = username
         self.password = password
         self.userid = userid
         self.admin = admin
         self.authenticated = False

    def is_anonymous(self):
         return False
    
    def is_authenticated(self):
         return self.authenticated
    
    def is_active(self):
         return True
    
    def get_id(self):
         return self.id



@login_manager.user_loader
def load_user(username):
    with get_db_connection() as conn:
        sqlFetchData = conn.execute(''' 
            SELECT * FROM (
                SELECT 
                    Email           AS Username,
                    Password        AS Password,
                    AdminID         AS UserID,
                    1               AS IsAdmin
                FROM 
                    Users_Administrators 
                
                UNION ALL

                SELECT 
                    Username        AS Username,
                    Passcode        AS Password,
                    StudentID       AS UserID,
                    0               AS IsAdmin
                FROM 
                    Users_Students 
            )
            WHERE 
                Username = ?
        ''', [username]).fetchall()

        
        if len(sqlFetchData) != 1:
            return None

        sqlFetchData = sqlFetchData[0]
        return User(sqlFetchData[0], sqlFetchData[1], sqlFetchData[2], sqlFetchData[3])

#########################################























################# VIEWS #################

with get_db_connection() as conn:

    # CREATE VIEW IF NOT EXISTS
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
                    PhishingTest_Answers.StudentID				    AS StudentID,
                    Users_Students.Username							AS Username,
                    PhishingTest_Answers.QuestionID			        AS QuestionID,
                    PhishingTest_Answers.AnswerStatus		        AS Answer,
                    PhishingTest_Questions.IsPhishing			    AS IsPhishing,
                    PhishingTest_Questions.Question				    AS QuestionText
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
                    _VIEW_GetUsersAnswersOptions.StudentID		                AS StudentID,
                    _VIEW_GetUsersAnswersOptions.Username		                AS Username,
                    _VIEW_GetUsersAnswersOptions.QuestionID  	                AS QuestionID,
                    COUNT(*)											        AS TotalOptionsCount,
                    SUM(IsAnswerOptionCorrectlySelected) 				        AS CorrectOptionsCount
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
            GetAnswerResults.IsAnswerCorrect														    AS IsAnswerCorrect,
            
            
            GetUsersAnswersOptionsResults.TotalOptionsCount						        AS TotalOptionsCount,
            GetUsersAnswersOptionsResults.CorrectOptionsCount					        AS CorrectOptionsCount,
            GetUsersAnswersOptionsResults.IsAllAnswerOptionsCorrect		                AS IsAllAnswerOptionsCorrect,
            GetUsersAnswersOptionsResults.CorrectOptionsPercentage			            AS CorrectOptionsPercentage,
            PRINTF("%.2f", IIF(GetAnswerResults.IsAnswerCorrect = 1, 1 - GetUsersAnswersOptionsResults.TotalOptionsCount *0.1 + GetUsersAnswersOptionsResults.CorrectOptionsCount * 0.1,   0)) 		AS AnswerPoints
        FROM
            GetAnswerResults
        LEFT JOIN GetUsersAnswersOptionsResults
            ON 	GetAnswerResults.StudentID 		= 	GetUsersAnswersOptionsResults.StudentID 		AND
						GetAnswerResults.QuestionID 		= 	GetUsersAnswersOptionsResults.QuestionID
        WHERE 
            GetAnswerResults.StudentID IN (SELECT StudentID FROM Users_Students)
    ''')


    # CREATE VIEW IF NOT EXISTS -- UPDATED
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
                Users_Students.StudentID 												AS StudentID,
                Users_Students.Username													AS Username,
                PhishingTest_Answers.QuestionID											AS QuestionID,
                PhishingTest_QuestionsOptions.QuestionOptionID							AS QuestionOptionID,
                PhishingTest_QuestionsOptions.QuestionOptionText						AS QuestionOptionText,
                PhishingTest_QuestionsOptions.AnswerStatus								AS RightAnswerOption,
                IFNULL(PhishingTest_AnswersSelectedOptions.IsSelected, 0) 				AS SelectedAnswerOption
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

    # CREATE VIEW IF NOT EXISTS
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
            PRINTF("%.2f", ROUND((TotalAnswerPoints / QuestionCount * 10), 2)) 	AS TestGrade,
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
#########################################









@app.route('/api/student/register', methods=['POST'])
def studentRegister_HTTPPOST():
    postData = request.get_json()
    username = re.sub(r'[^A-Z0-9_]', '', postData['username'].upper())
    

    with get_db_connection() as conn:
        if(conn.execute(' SELECT COUNT(*) FROM Users_Students WHERE Username = ? ', [username]).fetchone()[0] == 0):
            accessCode = str(random.randint(10**7, 10**8 - 1))
            returnJson = {
                "status": "OK",
                "username": username,
                "accessCode": accessCode
            }
            conn.execute(''' INSERT OR IGNORE INTO Users_Students 
                         (GroupID, Username, Passcode, IsFinished, LastLogin, Status) VALUES (?,?,?,?,?,?) ''', 
                         [0, username, accessCode, 0, '', 1])
            return Response(json.dumps(returnJson, indent=4), mimetype='application/json')
        else:
            returnJson = {
                "status": "error",
                "error": "Vartotojas tokiu vardu jau registruotas"
            }
            return Response(json.dumps(returnJson, indent=4), mimetype='application/json')





@app.route('/api/login', methods=['POST'])
def login_HTTPPOST():
    postData = request.get_json()

    # Preauth Checks
    if( not postData or (not postData.get('username') and not postData.get('password')) ):
        return "Įveskite Prisijungimo Vardą ir Slaptažodį."

    if( not postData.get('username') ):
        return "Įveskite Prisijungimo Vardą."

    if( not postData.get('password') ):
        return "Įveskite Slaptažodį."
    


    # Authentication
    thisUserObject = load_user(postData['username'])
    if(thisUserObject is not None):


        # Admin Login Check
        if('@' in thisUserObject.id):
            if( bcrypt.checkpw( str.encode(postData.get('password')), str.encode(thisUserObject.password) )):
                login_user(thisUserObject)
                return 'OK'
            else:
                # Dummy check
                bcrypt.checkpw( str.encode("This Only Used to prevent time based user enumeration attack, so doing nothing there."), 
                                str.encode('$2b$12$37rvWwtdP/sb.pZwBklPFeUxoH.KWOXIDjTxiiC9awCYpXIB8EbmS') )
            return "El. Paštas ir/arba Slaptažodis neteisingas."

        # Student Login Check
        else:
            if( postData.get('password') == thisUserObject.password ):    
                login_user(thisUserObject)
                return 'OK'
            return "Vardas ir/arba Slaptažodis neteisingas."
    
    
    else:
        # Dummy check
        bcrypt.checkpw( str.encode("This Only Used to prevent time based user enumeration attack, so doing nothing there."), 
                        str.encode('$2b$12$37rvWwtdP/sb.pZwBklPFeUxoH.KWOXIDjTxiiC9awCYpXIB8EbmS') )
        if('@' in postData['username']):
            return "El. Paštas ir/arba Slaptažodis neteisingas."
        else:
            return "Vardas ir/arba Slaptažodis neteisingas."




@app.route('/api/checkauth', methods=['GET'])
@login_required
def checkauth_HTTPGET():
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:

        # All Users
        user_info = {
            "id": current_user.id,
            "userid": current_user.userid,
            "admin": getattr(current_user, 'admin', False)
        }

    

        
        # Admin
        if(getattr(current_user, 'admin', False)):
            adminID = current_user.userid

            # Update LastLogin
            conn.execute('UPDATE Users_Administrators SET LastLogin = ? WHERE AdminID = ?', [timeNow, adminID])



        # Student
        else:
            studentID = current_user.userid

            user_info['passcode'] = current_user.password

            # Update LastLogin
            conn.execute('UPDATE Users_Students SET LastLogin = ? WHERE StudentID = ?', [timeNow, studentID])

            # Checking if student finished test
            user_info["phishingtestfinished"] = conn.execute(' SELECT IsFinished FROM Users_Students WHERE StudentID = ? ', [studentID]).fetchone()[0]
    
    
    return Response(json.dumps(user_info, indent=4), mimetype='application/json')




@app.route('/api/checkauth/admin', methods=['GET'])
@login_required
def checkauth_admin_HTTPGET():
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:

        # All Users
        user_info = {
            "id": current_user.id,
            "userid": current_user.userid,
            "admin": getattr(current_user, 'admin', False)
        }


        # Admin
        if(getattr(current_user, 'admin', False)):
            adminID = current_user.userid

            # Update LastLogin
            conn.execute('UPDATE Users_Administrators SET LastLogin = ? WHERE AdminID = ?', [timeNow, adminID])

            return Response(json.dumps(user_info, indent=4), mimetype='application/json')

    return jsonify({'message':'Unauthorized'}), 401







@app.route('/api/student/questions', methods=['GET', 'POST'])
@login_required
def studentQuestions_HTTP():
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if(getattr(current_user, 'admin', False) == False):
        studentID = int(current_user.userid)
    
        with get_db_connection() as conn:

            # Update LastLogin
            conn.execute('UPDATE Users_Students SET LastLogin = ? WHERE StudentID = ?', [timeNow, studentID])

            # If phishing test is already finished - STOP
            if(conn.execute(' SELECT IsFinished FROM Users_Students WHERE StudentID = ? ', [studentID]).fetchone()[0] == 1):
                return Response('{}', mimetype='application/json')





            if(request.method == 'GET'):

                # Get Phishing Test Size (Setting)
                phishingTestSizeSetting = conn.execute(' SELECT Value FROM System_Settings WHERE Name = ? ', ['PhishingTestSize']).fetchone()[0]
                if(phishingTestSizeSetting is None):
                    phishingTestSizeSetting = 30


                # Get student's current question count (that he's working on now)
                studentCurrentQuestionCount = conn.execute(' SELECT COUNT(*) FROM PhishingTest_Answers WHERE StudentID = ? ', [studentID]).fetchone()[0]

                # If student is not working on any questions yet, get random
                # questions based on the PhishingTestSize setting
                if(studentCurrentQuestionCount == 0):
                    conn.execute(f'''
                        INSERT INTO PhishingTest_Answers (StudentID, QuestionID, AnswerStatus)
                        SELECT
                            {studentID},
                            QuestionID,
                            NULL
                        FROM
                            PhishingTest_Questions
                        WHERE
                            IsEnabled = 1
                        ORDER BY RANDOM()
                        LIMIT {phishingTestSizeSetting}
                    ''')
                    conn.commit()

                    conn.execute(f'''
                        INSERT INTO PhishingTest_AnswersSelectedOptions (StudentID, QuestionID, QuestionOptionID, IsSelected)
                        SELECT
                            PhishingTest_Answers.StudentID,
                            PhishingTest_Answers.QuestionID,
                            PhishingTest_QuestionsOptions.QuestionOptionID,
                            NULL
                        FROM
                            PhishingTest_Answers
                        LEFT JOIN PhishingTest_QuestionsOptions
                            ON PhishingTest_Answers.QuestionID = PhishingTest_QuestionsOptions.QuestionID
                        WHERE
                            PhishingTest_Answers.StudentID = {studentID}
                    ''')
                    conn.commit()




                sqlFetchData = conn.execute(f'''
                    WITH GetQuestionOptions AS (
                        SELECT
                            PhishingTest_QuestionsOptions.QuestionID,
                            json_group_array (
                                json_object(
                                    'answeroptionid',   PhishingTest_QuestionsOptions.QuestionOptionID,
                                    'answeroption',     PhishingTest_QuestionsOptions.QuestionOptionText,
                                    'isselected',       PhishingTest_AnswersSelectedOptions.IsSelected
                                )
                            ) AS JSON
                        FROM
                            PhishingTest_QuestionsOptions
                        LEFT JOIN PhishingTest_AnswersSelectedOptions
                            ON PhishingTest_AnswersSelectedOptions.StudentID = {studentID} AND
                               PhishingTest_AnswersSelectedOptions.QuestionID = PhishingTest_QuestionsOptions.QuestionID AND
                               PhishingTest_AnswersSelectedOptions.QuestionOptionID = PhishingTest_QuestionsOptions.QuestionOptionID
                        GROUP BY PhishingTest_QuestionsOptions.QuestionID
                    ),
                    GetQuestionLinks AS (
                        SELECT
                            QuestionID,
                            json_group_array (
                                json_object(
                                    'title',        Title,
                                    'content',      Content,
                                    'x',            X,
                                    'y',            Y
                                )
                            ) AS JSON
                        FROM
                            PhishingTest_QuestionsLinks
                        GROUP BY QuestionID
                    ),
                    GetQuestions AS (
                        SELECT
                            PhishingTest_Questions.QuestionID       AS QuestionID,
                            PhishingTest_Answers.AnswerStatus       AS AnswerStatus,
                            PhishingTest_Questions.Question         AS Question,
                            IFNULL(GetQuestionOptions.JSON, '[]')   AS QuestionOptionsJSON,
                            IFNULL(GetQuestionLinks.JSON, '[]')     AS GetQuestionLinksJSON
                        FROM
                            PhishingTest_Questions
                        LEFT JOIN PhishingTest_Answers
                            ON PhishingTest_Answers.StudentID = {studentID} AND 
                                PhishingTest_Answers.QuestionID = PhishingTest_Questions.QuestionID


                        LEFT JOIN GetQuestionOptions
                            ON GetQuestionOptions.QuestionID = PhishingTest_Questions.QuestionID
                        LEFT JOIN GetQuestionLinks
                            ON GetQuestionLinks.QuestionID = PhishingTest_Questions.QuestionID
                        WHERE PhishingTest_Questions.IsEnabled = 1
                        AND PhishingTest_Questions.QuestionID IN (
                            SELECT QuestionID FROM PhishingTest_Answers WHERE StudentID = {studentID}
                        )
                        ORDER BY RANDOM() 
                    )

                                            

                    SELECT
                        json_group_array(        
                            json_object(
                                'questionid',           QuestionID,
                                'selectedanswer',       AnswerStatus,
                                'question',             Question,
                                'questionoptions',      JSON(QuestionOptionsJSON),
                                'questionlinks',        JSON(GetQuestionLinksJSON)
                            )
                        )
                    FROM
                        GetQuestions
                ''', [])
                return Response(json.dumps(json.loads(sqlFetchData.fetchone()[0]), indent=4), mimetype='application/json')




            elif(request.method == 'POST'):
                # start_time = time.time() # Time Measurement Code

                for questionJson in request.get_json():
                    if('questionid' in questionJson):

                        # Save student Question State
                        conn.execute(' INSERT OR IGNORE INTO PhishingTest_Answers VALUES (?,?,?) ', 
                                        [ studentID, questionJson['questionid'], questionJson['selectedanswer'] ])
                        conn.execute(' UPDATE PhishingTest_Answers SET AnswerStatus = ? WHERE StudentID = ? AND QuestionID = ? ', 
                                        [ questionJson['selectedanswer'], studentID, questionJson['questionid'] ])
                        conn.commit()
                    

                        # Save student Question Options State
                        for questionOptionJson in questionJson['questionoptions']:
                            if('answeroptionid' in questionOptionJson):
                                conn.execute(' INSERT OR IGNORE INTO PhishingTest_AnswersSelectedOptions VALUES (?,?,?,?) ', 
                                                [ studentID, questionJson['questionid'], questionOptionJson['answeroptionid'], questionOptionJson['isselected'] ])
                                conn.execute(' UPDATE PhishingTest_AnswersSelectedOptions SET IsSelected = ? WHERE StudentID = ? AND QuestionID = ? AND QuestionOptionID = ? ', 
                                                [ questionOptionJson['isselected'], studentID, questionJson['questionid'], questionOptionJson['answeroptionid'] ])
                                conn.commit()
                            else:
                                return 'Error: This is not questions state object'
                    
                    else:
                        return 'Error: This is not questions state object'

                # # Time Measurement Code
                # elapsed_time = time.time() - start_time
                # print(f"Execution time: {elapsed_time} seconds")
                return 'OK'

    return Response('{}', mimetype='application/json')




@app.route('/api/student/finish', methods=['GET'])
@login_required
def studentFinishTest_HTTP():
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if(getattr(current_user, 'admin', False) == False):
        studentID = int(current_user.userid)
        
        with get_db_connection() as conn:

            # Update LastLogin
            conn.execute('UPDATE Users_Students SET LastLogin = ? WHERE StudentID = ?', [timeNow, studentID])

            conn.execute('UPDATE Users_Students SET IsFinished = 1 WHERE StudentID = ?', [studentID])

    return Response('{}', mimetype='application/json')





@app.route('/api/admin/home', methods=['GET'])
@login_required
def homePage_HTTPGET():
    if(getattr(current_user, 'admin', False) == True):
        with get_db_connection() as conn:
            timeNow_minus30min = (datetime.now() - timedelta(hours=0, minutes=30)).strftime("%Y-%m-%d %H:%M:%S")

            sqlFetchData = conn.execute(f'''
                WITH GetStudentsProgress AS (
                    SELECT 
                        PhishingTest_Answers.StudentID,
						Users_Students.Username,
                        COUNT(*) AS QuestionCount,
                        IFNULL(     SUM(    IIF(PhishingTest_Answers.AnswerStatus IS NOT NULL, 1, 0)    )   , 0) AS AnsweredQuestionCount,
                        Users_Students.IsFinished,
                        Users_Students.LastLogin
                    FROM 
                        PhishingTest_Answers
                    LEFT JOIN Users_Students
                        ON Users_Students.StudentID = PhishingTest_Answers.StudentID
                    WHERE
                        Users_Students.LastLogin  > ?
                    GROUP BY PhishingTest_Answers.StudentID
                ),
                GetStudentsProgressJSON AS (
                    SELECT
                        json_group_array(
                            json_object(
                                'studentid',			    StudentID,
                                'username',	Username,
                                'questioncount',	QuestionCount,
                                'answeredquestioncount', AnsweredQuestionCount,
                                'isfinished',	IsFinished,
                                'lastlogin', LastLogin
                            )
                        ) AS JSON
                    FROM 
                        GetStudentsProgress
                )
                                        




                
                SELECT 
                    json_object(
                        'studentscount',            (SELECT COUNT(*) FROM Users_Students),
                        'enabledquestionscount',    (SELECT COUNT(*) FROM PhishingTest_Questions WHERE IsEnabled = 1),
                        'totalquestionscount',      (SELECT COUNT(*) FROM PhishingTest_Questions),
                        'phishingtestsize',         (SELECT CAST(Value AS INT) FROM System_Settings WHERE Name = 'PhishingTestSize'),
                        'studentsprogress',         (SELECT JSON(JSON) FROM GetStudentsProgressJSON)
                    )
            ''', [timeNow_minus30min])
            responseJson = sqlFetchData.fetchone()[0]
            responseJson = json.dumps(json.loads(responseJson), indent=4)
            return Response(responseJson, mimetype='application/json')
    return Response('{}', mimetype='application/json')












@app.route('/api/admin/administrators', methods=['GET', 'POST'])
@login_required
def administratorsList_HTTP():
    if(not current_user.admin):
        return 'Error: Not Admin'
    
    with get_db_connection() as conn:
        if request.method == "GET":
            sqlFetchData = conn.execute(f''' 
                SELECT
                    json_group_array(
                        json_object(
                            'id',           AdminID,
                            'email',        Email,
                            'enabled',      Enabled,
                            'lastseen',     LastLogin
                        )
                    )
                FROM
                    Users_Administrators
            ''')
            return Response(json.dumps(json.loads(sqlFetchData.fetchone()[0]), indent=4), mimetype='application/json')
        elif request.method == "POST":
            postData = request.get_json()

            if(postData['action'] == 'insertupdate'):
                passwordHash = bcrypt.hashpw(postData['password'].encode('utf-8'), bcrypt.gensalt(rounds=12)).decode("utf-8")

                if(postData['id'] == ''):
                    if(len(postData['password']) == 0):
                        return Response(json.dumps({'type': 'error', 'reason': 'Password must be at least 8 characters long'}), mimetype='application/json')
                    conn.execute(' INSERT OR IGNORE INTO Users_Administrators (Email, Password, Enabled) VALUES (?,?,?) ',
                                    [ postData['email'], passwordHash, postData['enabled'] ])
                else:    
                    if(len(postData['password']) != 0):
                        conn.execute(' UPDATE Users_Administrators SET Password = ? WHERE AdminID = ? ', [ passwordHash,         postData['id'] ])
                    conn.execute(' UPDATE Users_Administrators SET Email = ? WHERE AdminID = ? ',    [ postData['email'],    postData['id'] ])
                    conn.execute(' UPDATE Users_Administrators SET Enabled = ? WHERE AdminID = ? ',  [ postData['enabled'],  postData['id'] ])
                
                conn.commit()
                return Response(json.dumps({'type': 'ok'}), mimetype='application/json')
            

            elif(postData['action'] == 'delete'):
                conn.execute(' DELETE FROM Users_Administrators WHERE AdminID = ? ', [ postData['id'] ])
                conn.commit()
                return Response(json.dumps({'type': 'ok'}), mimetype='application/json')
            return Response(json.dumps({'type': 'error'}), mimetype='application/json')




@app.route('/api/admin/students', methods=['GET'])
@app.route('/api/admin/students/<int:studentID>', methods=['GET'])
@login_required
def studentsList_HTTPGET(studentID=None):
    if(not current_user.admin):
        if(studentID == current_user.userid):
            # Finished the test
            pass
        else:
            return 'Error: Not Admin'
    

    with get_db_connection() as conn:
        sqlFetchData = conn.execute(f'''
            WITH GetStudentsProgress AS (
                SELECT 
                    PhishingTest_Answers.StudentID,
                    Users_Students.Username,
                    COUNT(*) AS QuestionCount,
                    IFNULL(     SUM(    IIF(PhishingTest_Answers.AnswerStatus IS NOT NULL, 1, 0)    )   , 0) AS AnsweredQuestionCount,
                    Users_Students.IsFinished,
                    Users_Students.LastLogin
                FROM 
                    PhishingTest_Answers
                LEFT JOIN Users_Students
                    ON Users_Students.StudentID = PhishingTest_Answers.StudentID
                GROUP BY PhishingTest_Answers.StudentID
            ),
            GetTable AS (
                SELECT 
                    Users_Students.StudentID                                        AS ID,
                    Users_StudentGroups.Name                                        AS GroupName,
                    Users_Students.Username                                         AS Username,
                    Users_Students.Passcode                                         AS Passcode,

                    IFNULL(_VIEW_GetUsersTestResults.FullyCorrectCount, '')         AS FullyCorrectCount,
                    IFNULL(_VIEW_GetUsersTestResults.FullyCorrectPercentage, '')    AS FullyCorrectPercentage,


                    IFNULL(_VIEW_GetUsersTestResults.QuestionCount, '')             AS QuestionCount,
                    IFNULL(_VIEW_GetUsersTestResults.TotalIdentifiedCorrectly, '')  AS TotalIdentifiedCorrectly,


                    IFNULL(_VIEW_GetUsersTestResults.TotalOptionsCount, '')         AS TotalOptionsCount,
                    IFNULL(_VIEW_GetUsersTestResults.TotalCorrectOptionsCount, '')  AS TotalCorrectOptionsCount,


                    IFNULL(_VIEW_GetUsersTestResults.TestGrade, '')                 AS TestGrade,


                    Users_Students.IsFinished                                       AS IsFinished,
                    Users_Students.LastLogin                                        AS LastLogin,
                    Users_Students.Status                                           AS Status,
                    GetStudentsProgress.AnsweredQuestionCount                       AS AnsweredQuestionCount
                FROM 
                    Users_Students
                LEFT JOIN Users_StudentGroups
                    ON Users_Students.GroupID = Users_StudentGroups.GroupID
                LEFT JOIN _VIEW_GetUsersTestResults
                    ON Users_Students.StudentID = _VIEW_GetUsersTestResults.StudentID
                LEFT JOIN GetStudentsProgress
                    ON Users_Students.StudentID = GetStudentsProgress.StudentID
                { 
                    "WHERE Users_Students.StudentID = " + str(studentID) if studentID != None else ""
                }
                ORDER BY Users_Students.StudentID DESC
            )

            SELECT
                {"json_group_array(" if studentID == None else ""}
                    json_object(
                        'id',                       ID,
                        'username',                 Username,
                        'passcode',                 Passcode,
                        'groupname',                GroupName,
                        
                        'questioncount',            QuestionCount,
                        'answeredquestioncount',    AnsweredQuestionCount,
                        'totalidentifiedcorrectly', TotalIdentifiedCorrectly,

                        'fullycorrectcount',        FullyCorrectCount,
                        'fullycorrectpercentage',   FullyCorrectPercentage,

                        'totaloptionscount',        TotalOptionsCount,
                        'totalcorrectoptionscount', TotalCorrectOptionsCount,

                        'testgrade',                TestGrade,

                        'isfinished',               IsFinished,
                        'lastseen',                 LastLogin,
                        'status',                   Status
                    )
                {")" if studentID == None else ""}
            FROM 
                GetTable
        ''', [])
        return Response(json.dumps(json.loads(sqlFetchData.fetchone()[0]), indent=4), mimetype='application/json')







@app.route('/api/leaderboard', methods=['GET'])
def leaderboard_HTTPGET():
    with get_db_connection() as conn:
        sqlFetchData = conn.execute(f'''
            WITH GetStudentsProgress AS (
                SELECT 
                    PhishingTest_Answers.StudentID,
                    Users_Students.Username,
                    COUNT(*) AS QuestionCount,
                    IFNULL(     SUM(    IIF(PhishingTest_Answers.AnswerStatus IS NOT NULL, 1, 0)    )   , 0) AS AnsweredQuestionCount,
                    Users_Students.IsFinished,
                    Users_Students.LastLogin
                FROM 
                    PhishingTest_Answers
                LEFT JOIN Users_Students
                    ON Users_Students.StudentID = PhishingTest_Answers.StudentID
                GROUP BY PhishingTest_Answers.StudentID
            ),
            GetTable AS (
                SELECT 
                    Users_Students.StudentID                                        AS ID,
                    Users_Students.Username                                         AS Username,

                    IFNULL(_VIEW_GetUsersTestResults.QuestionCount, '')             AS QuestionCount,

                    IFNULL(_VIEW_GetUsersTestResults.TestGrade, '')                 AS TestGrade,

                    Users_Students.IsFinished                                       AS IsFinished,
                    Users_Students.LastLogin                                        AS LastLogin,
                    GetStudentsProgress.AnsweredQuestionCount                       AS AnsweredQuestionCount
                FROM 
                    Users_Students
                LEFT JOIN Users_StudentGroups
                    ON Users_Students.GroupID = Users_StudentGroups.GroupID
                LEFT JOIN _VIEW_GetUsersTestResults
                    ON Users_Students.StudentID = _VIEW_GetUsersTestResults.StudentID
                LEFT JOIN GetStudentsProgress
                    ON Users_Students.StudentID = GetStudentsProgress.StudentID
                ORDER BY Users_Students.StudentID DESC
            )

            SELECT
                json_group_array(
                    json_object(
                        'id',                       ID,
                        'username',                 Username,
                        
                        'questioncount',            QuestionCount,
                        'answeredquestioncount',    AnsweredQuestionCount,

                        'testgrade',                TestGrade,

                        'isfinished',               IsFinished,
                        'lastseen',                 LastLogin
                    )
                )
            FROM 
                GetTable
        ''', [])
        return Response(json.dumps(json.loads(sqlFetchData.fetchone()[0]), indent=4), mimetype='application/json')







@app.route('/api/admin/students/<int:studentID>/answers', methods=['GET'])
@login_required
def studentAnswers_HTTPGET(studentID=None):
    if(not current_user.admin):
        if(studentID == current_user.userid):
            # Finished the test
            pass
        else:
            return 'Error: Not Admin'
        
    
    with get_db_connection() as conn:
        sqlFetchData = conn.execute(f'''
            WITH GetUserAnsweredOptions_JSON AS (
                SELECT
                    StudentID,
                    QuestionID,
                    json_group_array(
                        json_object(
                            'optiontext',				QuestionOptionText,
                            'rightansweroption',		RightAnswerOption,
                            'selectedansweroption',	    SelectedAnswerOption
                        )
                    ) AS AnsweredOptions_JSON
                FROM
                    _VIEW_GetUsersAnswersOptions
                GROUP BY StudentID, QuestionID
            ),

            GetAnswered AS (
                SELECT
                    _VIEW_GetUsersAnswers.StudentID                AS StudentID,
                    json_group_array(
                        json_object(
                            'id',			        _VIEW_GetUsersAnswers.QuestionID,
                            'questiontext',			_VIEW_GetUsersAnswers.QuestionText,
                            'isphishinganswer',	    _VIEW_GetUsersAnswers.Answer,
                            'isphishing',			_VIEW_GetUsersAnswers.IsPhishing,
                            'totaloptionscount',    _VIEW_GetUsersAnswers.TotalOptionsCount,
                            'correctoptionscount',  _VIEW_GetUsersAnswers.CorrectOptionsCount,
                            'answerpoints',         _VIEW_GetUsersAnswers.AnswerPoints,
                            'answeredoptions',		json(AnsweredOptions_JSON)
                        )
                    )   AS JSON
                FROM
                    _VIEW_GetUsersAnswers
                
                LEFT JOIN GetUserAnsweredOptions_JSON
                    ON _VIEW_GetUsersAnswers.StudentID = GetUserAnsweredOptions_JSON.StudentID AND _VIEW_GetUsersAnswers.QuestionID = GetUserAnsweredOptions_JSON.QuestionID
                
                LEFT JOIN PhishingTest_Questions
                    ON PhishingTest_Questions.QuestionID = _VIEW_GetUsersAnswers.QuestionID
                    
                GROUP BY _VIEW_GetUsersAnswers.StudentID
            )
            
                SELECT 
                    JSON 
                FROM 
                    GetAnswered 
                WHERE StudentID = ?
        ''', [studentID])
        return Response(json.dumps(json.loads(sqlFetchData.fetchone()[0]), indent=4), mimetype='application/json')









@app.route('/api/admin/studentgroups', methods=['GET'])
@login_required
def studentGroupsList_HTTPGET():
    if(not current_user.admin):
        return 'Error: Not Admin'
    
    with get_db_connection() as conn:
        sqlFetchData = conn.execute(f'''
            WITH GetTable AS (
                SELECT
                    GroupID,
                    Name,
                    Description,
                    ShowAnswers,
                    TimeLimit
                FROM
                    Users_StudentGroups
                ORDER BY GroupID DESC
            )
                  
            SELECT
                json_group_array(
                    json_object(
                        'id',			    GroupID,
                        'name',			    Name,
                        'description',	    Description,
                        'showanswers',      ShowAnswers,
                        'timelimit',        TimeLimit
                    )
                )
            FROM 
                GetTable
        ''', [])
        return Response(json.dumps(json.loads(sqlFetchData.fetchone()[0]), indent=4), mimetype='application/json')










@app.route('/api/phishingpictures', methods=['POST'])
@login_required
def uploadPhishingPicture_HTTPPOST():
    if not current_user.admin:
        return jsonify({'type': 'error', 'reason': 'Not Admin'}), 403

    if 'image' not in request.files:
        return jsonify({'type': 'error', 'reason': 'No file part in the request'}), 400

    file = request.files['image']

    if file.filename == '':
        return jsonify({'type': 'error', 'reason': 'No selected file'}), 400


    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


    if file and allowed_file(file.filename):
        file_binary = file.read()

        if len(file_binary) > 5 * 1024 * 1024: # 5MB
            return jsonify({'type': 'error', 'reason': 'File is too large'}), 400

        with get_db_connection() as conn:
            timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(''' 
                INSERT INTO PhishingTest_Questions (IsEnabled, Points, IsPhishing, Question, Filename, Picture, PictureHeight, PictureWidth, Created)
                    VALUES (1,1,0,'','',?,0,0,?) ''', [file_binary, timeNow])
            conn.commit()

        return jsonify({'type': 'ok', 'message': 'Image uploaded successfully'})
    else:
        return jsonify({'type': 'error', 'reason': 'File type not allowed'}), 400






@app.route('/api/phishingpictures/<int:questionID>', methods=['GET'])
@login_required
def phishingPictures_HTTPGET(questionID):
    with get_db_connection() as conn:
        sqlFetchData = conn.execute(f'''
            SELECT Picture FROM PhishingTest_Questions WHERE QuestionID = ?
        ''', [questionID])
        pictureBinary = sqlFetchData.fetchone()[0]
        
        if pictureBinary[0:3] == b"\xff\xd8\xff":
            mimetype = 'image/jpeg'
        elif pictureBinary[0:8] == b"\x89PNG\r\n\x1a\n":
            mimetype = 'image/png'
        elif pictureBinary[0:3] == b"GIF":
            mimetype = 'image/gif'
        else:
            mimetype = 'application/octet-stream'
        
        return Response(pictureBinary, mimetype=mimetype)


@app.route('/api/phishingpictures/<int:questionID>/links', methods=['GET', 'POST'])
@login_required
def phishingPicturesLinks_HTTPGET(questionID):

    if(request.method == 'GET'):
        jsonObj = []
        with get_db_connection() as conn:
            sqlFetchData = conn.execute(f'''
                SELECT
                    json_group_array(
                        json_object(
                            'id',       QuestionLinkID,
                            'url',      Content,
                            'x',        CAST(X * 101 AS INTEGER) || '%',
                            'y',        CAST(Y * 101 AS INTEGER) || '%',
                            'width',    CAST(W * 101 AS INTEGER) || '%',
                            'height',   CAST(H * 101 AS INTEGER) || '%'
                        )
                    )
                FROM PhishingTest_QuestionsLinks
                WHERE QuestionID = {questionID}
            ''', [])
            jsonObj = sqlFetchData.fetchone()[0]
        jsonObj = json.dumps(json.loads(jsonObj), indent=4)
        return Response(jsonObj, mimetype='application/json')
    
    
    elif(request.method == 'POST'):
        if(not current_user.admin):
            return 'Error: Not Admin'
        postData = request.get_json()

        if('areas' in postData):
            for areaData in postData['areas']:
                print(json.dumps(areaData, indent=4))

        if('areas' in postData):
            with get_db_connection() as conn:
                conn.execute(f' DELETE FROM PhishingTest_QuestionsLinks WHERE QuestionID = {questionID} ')
                for areaData in postData['areas']:
                    print(json.dumps(areaData, indent=4))
                    sqlFetchData = conn.execute(f''' 
                        INSERT INTO PhishingTest_QuestionsLinks (QuestionID, Title, Content, X, Y, W, H) VALUES (?,?,?,?,?,?,?) 
                    ''', [questionID, '', areaData['url'], areaData['x'], areaData['y'], areaData['width'], areaData['height']])
                return 'OK'
            return 'Error'
        return 'OK'




@app.route('/api/admin/questions', methods=['GET'])
@login_required
def questionsList_HTTPGET():
    if(not current_user.admin):
        return 'Error: Not Admin'
    
    with get_db_connection() as conn:
        sqlFetchData = conn.execute(f'''
            WITH GetQuestionOptions AS (
                SELECT
                    QuestionID,
                    json_group_array (
                        json_object(
                            'optionid',             QuestionOptionID,
                            'optiontext',           QuestionOptionText,
                            'rightoptionanswer',    AnswerStatus
                        )
                    ) AS QuestionOptions
                FROM
                    PhishingTest_QuestionsOptions
                GROUP BY QuestionID
            ),
                                    
            GetAllTestQuestions AS (
                SELECT
                    json_group_array(
                        json_object(
                            'questionid',			QuestionID,
                            'isphishing',			IsPhishing,
                            'questiontext',		    Question,
                            'questionoptions',      JSON(IFNULL(QuestionOptions, '[]')),
                            'created',				Created
                        )
                    ) AS AllQuestions_JSON
                FROM
                (
                    SELECT
                        PhishingTest_Questions.QuestionID,
                        IsPhishing,
                        Question,
                        QuestionOptions,
                        Created
                    FROM
                        PhishingTest_Questions
                    LEFT JOIN GetQuestionOptions
                        ON PhishingTest_Questions.QuestionID = GetQuestionOptions.QuestionID
                    ORDER BY PhishingTest_Questions.QuestionID DESC
                )
            ),
                                    

            GetQuestionsSumary AS (
                SELECT
                    QuestionCount						AS QuestionCount,
                    PhishingCount						AS PhishingCount,
                    (QuestionCount - PhishingCount) 	AS GoodCount
                FROM (
                    SELECT
                        COUNT(*) 				            AS QuestionCount,
                        SUM(IsPhishing)			            AS PhishingCount
                    FROM
                        PhishingTest_Questions
                )
            )


            SELECT
                json_object(
                    'questioncount',	QuestionCount,
                    'phishingcount',	PhishingCount,
                    'goodcount',	    GoodCount,
                    'questions',		(SELECT JSON(AllQuestions_JSON) FROM GetAllTestQuestions)
                )
            FROM
                GetQuestionsSumary
        ''')
        return Response(json.dumps(json.loads(sqlFetchData.fetchone()[0]), indent=4), mimetype='application/json')



@app.route('/api/admin/questions/<string:action>', methods=['POST'])
@login_required
def questionsUpdate_HTTPPOST(action):
    if not current_user.admin:
        return 'Error: Not Admin', 403

    if request.method == 'POST':
        postData = request.get_json()
        questionID = postData['questionid']
        

        if(action == 'createnewquestion'):
            pass


        elif(action == 'createnewoption'):
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(' INSERT INTO PhishingTest_QuestionsOptions (QuestionID, QuestionOptionText, AnswerStatus) VALUES (?,?,?) ', [questionID, '', ''])
                conn.commit()
                new_option_id = cursor.lastrowid
            return jsonify({"new_option_id": new_option_id})


        elif(action == 'updatequestion'):
            with get_db_connection() as conn:
                conn.execute('UPDATE PhishingTest_Questions SET IsPhishing = ? WHERE QuestionID = ?', [postData['isphishing'],    questionID])
                conn.execute('UPDATE PhishingTest_Questions SET Question = ? WHERE QuestionID = ?',   [postData['questiontext'],  questionID])
                for questionOption in postData['questionoptions']:
                    conn.execute('UPDATE PhishingTest_QuestionsOptions SET QuestionOptionText = ? WHERE QuestionOptionID = ?',  [questionOption['optiontext'],        questionOption['optionid']])
                    conn.execute('UPDATE PhishingTest_QuestionsOptions SET AnswerStatus = ? WHERE QuestionOptionID = ?',        [questionOption['rightoptionanswer'], questionOption['optionid']])
                conn.commit()
            return jsonify({"status": "ok"})






@app.route('/api/admin/update/phishingtestsize', methods=['POST'])
@login_required
def phishinTestSize_HTTPPOST():
    if not current_user.admin:
        return 'Error: Not Admin', 403
    
    postData = request.get_json()
    testSize = int(postData['phishingtestsize'])

    with get_db_connection() as conn:
        conn.execute('INSERT OR IGNORE INTO System_Settings (Name, Value) VALUES (?, ?)', ['PhishingTestSize', testSize])
        conn.execute('UPDATE System_Settings SET Value = ? WHERE Name = ?', [testSize, 'PhishingTestSize'])
        conn.commit()

    return jsonify({"status": "ok"})
    
    









if __name__ == '__main__':


    if(len(sys.argv) == 1):
        print("Empty")

    elif(sys.argv[1] == "--optimize-db"):
        with get_db_connection() as conn:
            conn.execute(''' 
                DELETE FROM PhishingTest_Answers
                WHERE StudentID NOT IN (SELECT StudentID FROM Users_Students)
            ''')
            conn.commit()

            conn.execute(''' 
                DELETE FROM PhishingTest_AnswersSelectedOptions 
                WHERE StudentID NOT IN (SELECT StudentID FROM Users_Students)
            ''')
            conn.commit()

            conn.execute('VACUUM')
            conn.commit()



    elif(sys.argv[1] == "--http"):
        app.run(host='0.0.0.0', port=8000, debug=APP_DEBUG)


    elif(sys.argv[1] == "--pics2sqlite"):
        directory_path = "./uploads"

        def insert_images_into_db(db_connection, directory_path):
            cursor = db_connection.cursor()

            for filename in os.listdir(directory_path):
                if filename.endswith(('.jpg', '.png', '.jpeg', '.gif', '.PNG')):

                    with open(os.path.join(directory_path, filename), 'rb') as image_file:
                        picture_data = image_file.read()

                    cursor.execute("INSERT OR IGNORE INTO PhishingTest_Pictures (Filename, Picture) VALUES (?, ?)", [filename, picture_data])
                    db_connection.commit()

                    os.remove(os.path.join(directory_path, filename))

            print("Images inserted successfully!")


        with get_db_connection() as conn:
            insert_images_into_db(conn, directory_path)



