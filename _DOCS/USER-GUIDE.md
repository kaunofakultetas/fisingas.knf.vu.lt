# User Guide

## For Students

### Registering

1. Go to the login page
2. Click **Register** and enter your desired username
3. You will receive a **username** and an **access code**
4. **Write down your access code immediately** -- it is only shown once and cannot be recovered
5. Log in with your username and access code

### Taking the Test

1. After logging in, you will see a phishing test question - a screenshot of an email
2. Examine the image carefully. You can click on the image to zoom in
3. The image may have **clickable areas** (links) - hover and click to inspect them
4. Choose your answer:
   - **Tikras** (Real) - if you believe the email is legitimate
   - **Fišingas** (Phishing) - if you believe it is a phishing attempt
5. Answer any additional questions below the image (checkboxes)
6. Use the **sidebar buttons** to navigate between questions. Answered questions appear greyed out
7. Your answers are **saved automatically** as you go
8. When you have answered all questions, click **Užbaigti testą** (Finish test). **This is irreversible** -- you cannot change your answers after finishing

### Viewing Results

After finishing the test, you will see:
- **Test grade** (out of 10)
- **Fully correct** count - questions where both the main answer and all options were correct
- **Correctly identified** count - questions where the Real/Phishing answer was correct
- **Correct options** count - individual options answered correctly
- A detailed breakdown of each question and your answers

---

<br/>

## For Administrators

### Logging In

Log in with your admin email and password. The default account is `admin@admin.com` / `admin`.

### Dashboard

The admin home page shows:
- **Total students** registered
- **Questions** count (enabled / total)
- **Test size** - how many questions each student receives (click to change)
- **Student progress** - students currently taking the test

### Managing Questions

**Navigating:** Sidebar > Questions

Each question consists of:
- A **screenshot image** of an email (uploaded as PNG/JPG/GIF)
- A **question text**
- A **phishing flag** - whether this email is phishing or real
- **Answer options** - additional true/false questions about the email
- **Clickable areas** - regions on the image that students can interact with (simulating links)

**To add a question:**
1. Go to the Questions page
2. Click the add button
3. Upload an image, fill in the question text, and set whether it's phishing
4. Add answer options and configure clickable areas on the image

**To edit a question:**
1. Click on the question in the list
2. Modify any fields and save

### Managing Students

**Navigating:** Sidebar > Students

The students list shows all registered students with:
- Username, group, status
- Test progress and grade

Click on a student to see their detailed answers and test summary.

### Managing Administrators

**Navigating:** Sidebar > Administrators

Add, edit, or disable admin accounts. Each admin needs an email and password.

### Managing Student Groups

**Navigating:** Sidebar > Student Groups

Groups allow organizing students. Each group can have settings like:
- **Show answers** - whether students can see correct answers after finishing
- **Time limit** - test duration limit

### Configuring Test Size

From the dashboard, click on the test size value to change how many questions are randomly assigned to each student. Available options: 9, 12, 15, 21, or 30.

### Presentation Mode

**Slides:** Sidebar > Slides (run)

Opens a full-screen presentation that cycles between:
- The student leaderboard
- Slide images from the slides directory

Useful for displaying on a projector during class.

**Managing slides:** Sidebar > Slides (files) opens the Filebrowser where you can upload slide images (PNG, JPG, GIF, WEBP).

### Additional Admin Tools

| Tool | Access | Purpose |
|------|--------|---------|
| **Filebrowser (Dropbox)** | Sidebar > File Dropbox | Upload and manage general files |
| **Filebrowser (Slides)** | Sidebar > Slides (files) | Upload and manage presentation slides |
| **DBGate** | Sidebar > Database | Browse and query the SQLite database directly |

These tools are accessible only to logged-in administrators.

---

<br/>

## Public Pages

### Leaderboard

Available at `/leaderboard` without login. Shows all students ranked by test score. Auto-refreshes every 5 seconds.

### Slides / Presentation

Available at `/slides` without login. Alternates between the leaderboard and slide images every 6 seconds.
