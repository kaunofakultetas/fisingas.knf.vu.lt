############################################################
# Author:           Tomas Vanagas
# Updated:          2025-07-27
# Version:          1.0
# Description:      User model (Fisingas Specific)
############################################################


from flask_login import UserMixin, LoginManager
from ..database.db import get_db_connection


login_manager = LoginManager()


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
                    ID              AS UserID,
                    1               AS IsAdmin
                FROM 
                    System_Users 
                
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
    

