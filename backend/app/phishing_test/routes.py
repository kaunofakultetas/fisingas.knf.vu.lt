############################################################
# Author:           Tomas Vanagas
# Updated:          2025-07-27
# Version:          1.0
# Description:      Phishing Test App Routes
############################################################



from flask import Blueprint, request, Response, jsonify
from flask_login import login_user, login_required, current_user
import bcrypt
import json
from datetime import datetime, timedelta

from ..auth.user import load_user
from ..database.db import get_db_connection




phishing_test_bp = Blueprint('phishing_test', __name__)










@phishing_test_bp.route('/api/student/questions', methods=['GET', 'POST'])
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




@phishing_test_bp.route('/api/student/finish', methods=['GET'])
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





@phishing_test_bp.route('/api/admin/home', methods=['GET'])
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










@phishing_test_bp.route('/api/leaderboard', methods=['GET'])
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






@phishing_test_bp.route('/api/admin/students/<int:studentID>/answers', methods=['GET'])
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









@phishing_test_bp.route('/api/admin/studentgroups', methods=['GET'])
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










@phishing_test_bp.route('/api/phishingpictures', methods=['POST'])
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






@phishing_test_bp.route('/api/phishingpictures/<int:questionID>', methods=['GET'])
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


@phishing_test_bp.route('/api/phishingpictures/<int:questionID>/links', methods=['GET', 'POST'])
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




@phishing_test_bp.route('/api/admin/questions', methods=['GET'])
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



@phishing_test_bp.route('/api/admin/questions/<string:action>', methods=['POST'])
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






@phishing_test_bp.route('/api/admin/update/phishingtestsize', methods=['POST'])
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
    
    


