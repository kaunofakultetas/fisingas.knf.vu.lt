############################################################
# Author:           Tomas Vanagas
# Updated:          2025-07-27
# Version:          1.0
# Description:      Authentication and user 
#                   management routes (Fisingas Specific)
############################################################


from flask import Blueprint, request, Response, jsonify
from flask_login import login_user, login_required, current_user
import bcrypt
import json
from datetime import datetime
import random
import re

from .user import load_user
from ..database.db import get_db_connection




auth_bp = Blueprint('auth', __name__)





@auth_bp.route('/api/login', methods=['POST'])
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




@auth_bp.route('/api/checkauth', methods=['GET'])
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
            conn.execute('UPDATE System_Users SET LastLogin = ? WHERE ID = ?', [timeNow, adminID])



        # Student
        else:
            studentID = current_user.userid

            user_info['passcode'] = current_user.password

            # Update LastLogin
            conn.execute('UPDATE Users_Students SET LastLogin = ? WHERE StudentID = ?', [timeNow, studentID])

            # Checking if student finished test
            user_info["phishingtestfinished"] = conn.execute(' SELECT IsFinished FROM Users_Students WHERE StudentID = ? ', [studentID]).fetchone()[0]
    
    
    return Response(json.dumps(user_info, indent=4), mimetype='application/json')








@auth_bp.route('/api/checkauth/admin', methods=['GET'])
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
            conn.execute('UPDATE System_Users SET LastLogin = ? WHERE ID = ?', [timeNow, adminID])

            return Response(json.dumps(user_info, indent=4), mimetype='application/json')

    return jsonify({'message':'Unauthorized'}), 401









@auth_bp.route('/api/admin/administrators', methods=['GET', 'POST'])
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
                            'id',           ID,
                            'email',        Email,
                            'enabled',      Enabled,
                            'lastseen',     LastLogin
                        )
                    )
                FROM
                    System_Users
            ''')
            return Response(json.dumps(json.loads(sqlFetchData.fetchone()[0]), indent=4), mimetype='application/json')
        elif request.method == "POST":
            postData = request.get_json()

            if(postData['action'] == 'insertupdate'):
                passwordHash = bcrypt.hashpw(postData['password'].encode('utf-8'), bcrypt.gensalt(rounds=12)).decode("utf-8")

                if(postData['id'] == ''):
                    if(len(postData['password']) == 0):
                        return Response(json.dumps({'type': 'error', 'reason': 'Password must be at least 8 characters long'}), mimetype='application/json')
                    conn.execute(' INSERT OR IGNORE INTO System_Users (Email, Password, Enabled) VALUES (?,?,?) ',
                                    [ postData['email'], passwordHash, postData['enabled'] ])
                else:    
                    if(len(postData['password']) != 0):
                        conn.execute(' UPDATE System_Users SET Password = ? WHERE ID = ? ', [ passwordHash,         postData['id'] ])
                    conn.execute(' UPDATE System_Users SET Email = ? WHERE ID = ? ',    [ postData['email'],    postData['id'] ])
                    conn.execute(' UPDATE System_Users SET Enabled = ? WHERE ID = ? ',  [ postData['enabled'],  postData['id'] ])
                
                conn.commit()
                return Response(json.dumps({'type': 'ok'}), mimetype='application/json')
            

            elif(postData['action'] == 'delete'):
                conn.execute(' DELETE FROM System_Users WHERE ID = ? ', [ postData['id'] ])
                conn.commit()
                return Response(json.dumps({'type': 'ok'}), mimetype='application/json')
            return Response(json.dumps({'type': 'error'}), mimetype='application/json')





@auth_bp.route('/api/admin/students', methods=['GET'])
@auth_bp.route('/api/admin/students/<int:studentID>', methods=['GET'])
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
    






@auth_bp.route('/api/student/register', methods=['POST'])
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
