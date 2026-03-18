# API Reference

All endpoints are served under `/api/`. Authentication is session-based using cookies.

**Auth levels:**
- **Public** -- no authentication required
- **Login** -- any authenticated user (admin or student)
- **Admin** -- admin users only
- **Student** -- student users only

---

<br/>

## Authentication

### `POST /api/login`

**Auth:** Public

Log in as admin or student.

| Field | Type | Description |
|-------|------|-------------|
| `username` | string | Email (admin) or username (student) |
| `password` | string | Password (admin) or access code (student) |

**Response:** `"OK"` on success, error message (in Lithuanian) on failure.

The system distinguishes admins from students by whether the username contains `@`.

---

### `GET /api/checkauth`

**Auth:** Login

Returns the current user's identity. Also updates the user's last-login timestamp.

**Admin response:**

```json
{
    "id": "admin@admin.com",
    "userid": 1,
    "admin": 1
}
```

**Student response:**

```json
{
    "id": "JOHN_DOE",
    "userid": 5,
    "admin": 0,
    "passcode": "48291037",
    "phishingtestfinished": 0
}
```

> **Note:** `id` is the login name (email or username). `userid` is the database primary key.

---

### `GET /api/checkauth/admin`

**Auth:** Admin

Same as `/api/checkauth` but returns `401` if the user is not an admin. Used internally by Caddy for forward authentication on admin-only tools.

---

<br/>

## Student Registration

### `POST /api/student/register`

**Auth:** Public

Register a new student account. Usernames are auto-uppercased and restricted to `A-Z`, `0-9`, `_`.

| Field | Type | Description |
|-------|------|-------------|
| `username` | string | Desired username |

**Response:**

```json
{
    "status": "OK",
    "username": "JOHN_DOE",
    "accessCode": "48291037"
}
```

If the username is already taken:

```json
{
    "status": "error",
    "error": "Vartotojas tokiu vardu jau registruotas"
}
```

---

<br/>

## Phishing Test (Student)

### `GET /api/student/questions`

**Auth:** Student

Returns the student's assigned test questions. On the first call, the system randomly assigns questions based on the configured test size.

Returns `{}` if the test is already finished.

**Response:**

```json
[
    {
        "questionid": 3,
        "selectedanswer": null,
        "question": "Is this email legitimate?",
        "questionoptions": [
            {
                "answeroptionid": 7,
                "answeroption": "The sender domain looks suspicious",
                "isselected": null
            }
        ],
        "questionlinks": [
            {
                "title": "Link text",
                "content": "http://example.com",
                "x": "0.15",
                "y": "0.42"
            }
        ]
    }
]
```

---

<br/>

### `POST /api/student/questions`

**Auth:** Student

Save the student's answers. Can be called multiple times -- answers are upserted.

**Body:**

```json
[
    {
        "questionid": 3,
        "selectedanswer": 1,
        "questionoptions": [
            { "answeroptionid": 7, "isselected": 1 }
        ]
    }
]
```

| Field | Values |
|-------|--------|
| `selectedanswer` | `1` = Phishing, `0` = Real, `null` = not answered |
| `isselected` | `1` = selected, `0` or `null` = not selected |

**Response:** `"OK"` on success.

---

### `GET /api/student/finish`

**Auth:** Student

Marks the student's test as finished. **This is irreversible.**

**Response:** `{}`

---

<br/>

## Questions (Admin)

### `GET /api/admin/questions`

**Auth:** Admin

Returns all questions with their options and a summary.

**Response:**

```json
{
    "questioncount": 20,
    "phishingcount": 12,
    "goodcount": 8,
    "questions": [
        {
            "questionid": 1,
            "isphishing": 1,
            "questiontext": "Is this email legitimate?",
            "questionoptions": [
                {
                    "optionid": 7,
                    "optiontext": "The sender domain looks suspicious",
                    "rightoptionanswer": 1
                }
            ],
            "created": "2025-01-15 14:30:00"
        }
    ]
}
```

---

### `POST /api/admin/questions/createnewoption`

**Auth:** Admin

Add a new (empty) answer option to a question.

| Field | Type | Description |
|-------|------|-------------|
| `questionid` | int | Target question ID |

**Response:**

```json
{ "new_option_id": 12 }
```

---

### `POST /api/admin/questions/updatequestion`

**Auth:** Admin

Update a question's text, phishing flag, and options.

| Field | Type | Description |
|-------|------|-------------|
| `questionid` | int | Question ID |
| `questiontext` | string | Question text |
| `isphishing` | int | `1` = phishing, `0` = real |
| `questionoptions` | array | Options (see below) |

Each item in `questionoptions`:

| Field | Type | Description |
|-------|------|-------------|
| `optionid` | int | Option ID |
| `optiontext` | string | Option text |
| `rightoptionanswer` | int | `1` = correct, `0` = incorrect |

**Response:**

```json
{ "status": "ok" }
```

---

<br/>

## Question Images

### `POST /api/phishingpictures`

**Auth:** Admin

Create a new question by uploading an image. The question is created with default values (empty text, `isphishing = 0`). Edit the question afterwards to fill in the details.

Sent as `multipart/form-data`:

| Field | Type | Description |
|-------|------|-------------|
| `image` | file | Image file (PNG, JPG, GIF). Max 5 MB |

**Response:**

```json
{ "type": "ok", "message": "Image uploaded successfully" }
```

---

### `GET /api/phishingpictures/:questionID`

**Auth:** Login

Returns the question's image as a binary response with the correct MIME type (`image/png`, `image/jpeg`, or `image/gif`).

---

### `GET /api/phishingpictures/:questionID/links`

**Auth:** Login

Returns clickable areas defined on the question image. Coordinates are percentages (as strings like `"15%"`).

**Response:**

```json
[
    {
        "id": 1,
        "url": "http://example.com",
        "x": "15%",
        "y": "42%",
        "width": "20%",
        "height": "3%"
    }
]
```

---

### `POST /api/phishingpictures/:questionID/links`

**Auth:** Admin

Replace all clickable areas for a question image. Any existing areas are deleted first.

**Body:**

```json
{
    "areas": [
        { "url": "http://example.com", "x": 0.15, "y": 0.42, "width": 0.20, "height": 0.03 }
    ]
}
```

**Response:** `"OK"`

---

<br/>

## Students (Admin)

### `GET /api/admin/students`

**Auth:** Admin

Returns all students with progress and test statistics.

**Response:** Array of student objects (same structure as the single-student endpoint below).

---

### `GET /api/admin/students/:studentID`

**Auth:** Admin (or the student themselves)

Returns detailed info for a specific student.

**Response:**

```json
{
    "id": 5,
    "username": "JOHN_DOE",
    "passcode": "48291037",
    "groupname": "Group A",
    "questioncount": 9,
    "answeredquestioncount": 9,
    "totalidentifiedcorrectly": 7,
    "fullycorrectcount": 5,
    "fullycorrectpercentage": 55,
    "totaloptionscount": 18,
    "totalcorrectoptionscount": 15,
    "testgrade": "7.50",
    "isfinished": 1,
    "lastseen": "2025-01-15 14:30:00",
    "status": 1
}
```

---

### `GET /api/admin/students/:studentID/answers`

**Auth:** Admin (or the student themselves)

Returns the student's detailed answers with correctness, points, and selected options.

**Response:**

```json
[
    {
        "id": 3,
        "questiontext": "Is this email legitimate?",
        "isphishinganswer": 1,
        "isphishing": 1,
        "totaloptionscount": 2,
        "correctoptionscount": 2,
        "answerpoints": "1.00",
        "answeredoptions": [
            {
                "optiontext": "The sender domain looks suspicious",
                "rightansweroption": 1,
                "selectedansweroption": 1
            }
        ]
    }
]
```

---

<br/>

## Administrators

### `GET /api/admin/administrators`

**Auth:** Admin

Returns all administrator accounts.

**Response:**

```json
[
    { "id": 1, "email": "admin@admin.com", "enabled": 1, "lastseen": "2025-01-15 14:30:00" }
]
```

---

### `POST /api/admin/administrators`

**Auth:** Admin

Create, update, or delete administrators.

**Create** (set `id` to empty string):

```json
{ "action": "insertupdate", "id": "", "email": "new@admin.com", "password": "secret", "enabled": 1 }
```

**Update** (provide existing `id`):

```json
{ "action": "insertupdate", "id": "5", "email": "updated@admin.com", "password": "newpass", "enabled": 1 }
```

> When updating, if `password` is empty the existing password is kept.

**Delete:**

```json
{ "action": "delete", "id": "5" }
```

---

<br/>

## Student Groups

### `GET /api/admin/studentgroups`

**Auth:** Admin

Returns all student groups with their settings.

**Response:**

```json
[
    {
        "id": 1,
        "name": "Group A",
        "description": "Morning session",
        "showanswers": 0,
        "timelimit": 0
    }
]
```

---

<br/>

## Dashboard

### `GET /api/admin/home`

**Auth:** Admin

Returns dashboard statistics and a list of students active in the last 30 minutes.

**Response:**

```json
{
    "studentscount": 42,
    "enabledquestionscount": 15,
    "totalquestionscount": 20,
    "phishingtestsize": 9,
    "studentsprogress": [
        {
            "studentid": 5,
            "username": "JOHN_DOE",
            "questioncount": 9,
            "answeredquestioncount": 4,
            "isfinished": 0,
            "lastlogin": "2025-01-15 14:30:00"
        }
    ]
}
```

---

### `POST /api/admin/update/phishingtestsize`

**Auth:** Admin

Update the number of questions per test.

| Field | Type | Description |
|-------|------|-------------|
| `phishingtestsize` | int | New test size |

**Response:**

```json
{ "status": "ok" }
```

---

<br/>

## Leaderboard

### `GET /api/leaderboard`

**Auth:** Public

Returns all students ranked by test score.

**Response:**

```json
[
    {
        "id": 5,
        "username": "JOHN_DOE",
        "questioncount": 9,
        "answeredquestioncount": 9,
        "testgrade": "8.50",
        "isfinished": 1,
        "lastseen": "2025-01-15 14:30:00"
    }
]
```

---

### `GET /api/leaderboard/nextslide`

**Auth:** Public

Returns a random slide image from the slides directory as a binary response. Supports PNG, JPG, GIF, and WEBP.

Returns `404` if no slides are available.
