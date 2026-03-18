############################################################
# Author:           Tomas Vanagas
# Updated:          2026-03-18
# Version:          1.0
# Description:      App Initialization
############################################################


from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix


import random
import os
import hashlib
from datetime import datetime




APP_DEBUG = os.getenv('APP_DEBUG', 'false').lower() == "true"



def create_app():

    ############# Database Initialization #############
    from .database.db_init import init_db
    init_db()

    ###################################################




    ############# Flask App Initialization ############
    app = Flask(__name__)

    # Trust X-Forwarded-For headers from reverse proxy
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)


    # Initialize Flask extensions
    if(APP_DEBUG):
        app.secret_key = hashlib.sha256(datetime.now().strftime("%Y-%m-%d").encode()).digest()
    else:
        app.secret_key = random.randbytes(32)
    app.config['SESSION_COOKIE_HTTPONLY'] = False


    # Initialize Flask login manager
    from .auth.user import login_manager
    login_manager.init_app(app)

    ###################################################



    
    ################## UI Blueprints ##################
    from .auth.routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='')
    
    from .phishing_test.routes import phishing_test_bp
    app.register_blueprint(phishing_test_bp, url_prefix='')

    from .leaderboard.routes import leaderboard_bp
    app.register_blueprint(leaderboard_bp, url_prefix='')

    ###################################################

    
    return app