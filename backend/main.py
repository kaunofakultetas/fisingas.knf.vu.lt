############################################################
# Author:           Tomas Vanagas
# Updated:          2025-07-27
# Version:          1.0
# Description:      App entry point (Fisingas Specific)
############################################################


import sys
from app import create_app
from app.database.db import get_db_connection



if __name__ == '__main__':
    

    if(len(sys.argv) == 1):
        print("[*] Explanation is comming... ")



    elif(sys.argv[1] == "--http"):
        app = create_app()
        app.run(host='0.0.0.0', port=8080, debug=True)



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

