############################################################
# Author:           Tomas Vanagas
# Updated:          2025-06-29
# Version:          1.0
# Description:      App Initialization
############################################################


from flask import Flask
import random
import os
import hashlib
from datetime import datetime




APP_DEBUG = os.getenv('APP_DEBUG', 'false').lower() == "true"



def create_app():

    # Initialize database
    from .database.db_init import init_db
    init_db()


    # Initialize Flask app
    app = Flask(__name__)


    # Initialize Flask extensions
    if(APP_DEBUG):
        app.secret_key = hashlib.sha256(datetime.now().strftime("%Y-%m-%d").encode()).digest()
    else:
        app.secret_key = random.randbytes(32)
    app.config['SESSION_COOKIE_HTTPONLY'] = False


    # Initialize Flask login manager
    from .auth.user import login_manager
    login_manager.init_app(app)

    
    # Register blueprints
    from .auth.routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='')
    
    from .phishing_test.routes import phishing_test_bp
    app.register_blueprint(phishing_test_bp, url_prefix='')



    
    return app