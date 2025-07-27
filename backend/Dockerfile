FROM python:3.12.3-alpine

WORKDIR /app

RUN pip install --no-cache-dir      \
    "Flask==3.0.0"                  \
    "Flask-Login==0.6.3"            \
    "Flask-RESTful==0.3.10"         \
    "Flask-CORS==4.0.0"             \
    "bcrypt==4.2.1"


EXPOSE 8080
CMD ["python3", "main.py", "--http"]
