############################################################
# Author:           Tomas Vanagas
# Updated:          2026-01-07
# Version:          1.0
# Description:      Leaderboard App Routes
############################################################



from flask import Blueprint, Response, send_file

import json
import os
import random
from ..database.db import get_db_connection



ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}



leaderboard_bp = Blueprint('leaderboard', __name__)








@leaderboard_bp.route('/api/leaderboard', methods=['GET'])
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






@leaderboard_bp.route('/api/leaderboard/nextslide', methods=['GET'])
def leaderboardSlides_HTTPGET():
    """Return a random slide image from the slides directory."""

    SLIDES_DIRECTORY = os.getenv('SLIDES_DIRECTORY', '/slides')
    
    # Check if slides directory exists
    if not os.path.isdir(SLIDES_DIRECTORY):
        return Response(
            json.dumps({"error": "Slides directory not found"}),
            status=404,
            mimetype='application/json'
        )
    
    # Get all image files from the directory
    image_files = [
        f for f in os.listdir(SLIDES_DIRECTORY)
        if os.path.isfile(os.path.join(SLIDES_DIRECTORY, f))
        and os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    ]
    
    # Check if there are any images
    if not image_files:
        return Response(
            json.dumps({"error": "No slide images found"}),
            status=404,
            mimetype='application/json'
        )
    
    # Pick a random image
    random_image = random.choice(image_files)
    image_path = os.path.join(SLIDES_DIRECTORY, random_image)
    
    # Return the image file
    return send_file(image_path)