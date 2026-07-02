############################################################
#  [*] Question picture endpoints
#
#    POST /api/phishingpictures            — upload → new question
#    GET  /api/phishingpictures/<id>       — the image bytes
#    POST /api/phishingpictures/<id>/links — replace the clickable areas
#    GET  /api/phishingpictures/<id>/links — clickable areas
#
#  Images are UPLOAD-ONLY: every upload creates an immutable
#  QuestionImage row that both the live question and the
#  frozen answer snapshots reference (PROTECT), so deleting a
#  question can never take down the picture — or the tooltip
#  links attached to it — of an already-graded test.
############################################################


from datetime import datetime

from django.http import Http404, HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from ..models import Answer, Question, QuestionImage, QuestionLink


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}








############################################################
# upload_picture
############################################################
#
# POST /api/phishingpictures — multipart "image" field.
# Creating a question STARTS with the screenshot: the upload
# stores the image and creates an empty question around it,
# which the admin then fills in (text, verdict, options)
# through the question bank editor.
#
# Used by:
#   - AddQuestion.jsx — the dropzone on the questions page
############################################################

@login_required
def upload_picture(request):
    if not request.current_user.admin:
        return JsonResponse({"type": "error", "reason": "Not Admin"}, status=403)

    if "image" not in request.FILES:
        return JsonResponse({"type": "error", "reason": "No file part in the request"}, status=400)

    file = request.FILES["image"]

    if file.name == "":
        return JsonResponse({"type": "error", "reason": "No selected file"}, status=400)

    if "." not in file.name or file.name.rsplit(".", 1)[1].lower() not in ALLOWED_EXTENSIONS:
        return JsonResponse({"type": "error", "reason": "File type not allowed"}, status=400)

    file_binary = file.read()

    if len(file_binary) > 5 * 1024 * 1024:  # 5MB
        return JsonResponse({"type": "error", "reason": "File is too large"}, status=400)

    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # The image row is upload-only — it will outlive the question
    image = QuestionImage.objects.create(
        image=file_binary,
        created=timeNow,
    )

    # An empty, enabled question wrapped around the new image;
    # the admin fills in the content in the bank editor next
    Question.objects.create(
        is_enabled=1,
        is_phishing=0,
        question="",
        image=image,
        created=timeNow,
    )

    return JsonResponse({"type": "ok", "message": "Image uploaded successfully"})








############################################################
# _resolve_image (helper)
############################################################
#
# The QuestionImage behind a question bank ID. When the
# question still exists its image is used directly; when it
# was deleted, the image is found through the frozen answer
# snapshots that reference it — so old graded tests keep
# their pictures (and the tooltips attached to them) forever.
#
# Used by:
#   - get_picture (below)
#   - picture_links (below)
############################################################

def _resolve_image(questionID):
    try:
        return Question.objects.select_related("image").get(id=questionID).image
    except Question.DoesNotExist:
        answer = (
            Answer.objects
            .filter(question_id=questionID, image__isnull=False)
            .select_related("image")
            .first()
        )
        if answer is None:
            raise Http404
        return answer.image








############################################################
# get_picture
############################################################
#
# GET /api/phishingpictures/<id> — the raw image bytes.
# The mimetype is sniffed from the magic bytes because the
# database stores only the blob, not the original filename's
# extension.
#
# Used by:
#   - TestHome.jsx                — the question being answered
#   - StudentAnswers.jsx          — admin answer review
#   - StudentTestSummaryTable.jsx — the summary thumbnails
#   - QuestionsList.jsx           — the question bank editor
############################################################

@login_required
def get_picture(request, questionID):
    pictureBinary = bytes(_resolve_image(questionID).image)

    if pictureBinary[0:3] == b"\xff\xd8\xff":
        mimetype = "image/jpeg"
    elif pictureBinary[0:8] == b"\x89PNG\r\n\x1a\n":
        mimetype = "image/png"
    elif pictureBinary[0:3] == b"GIF":
        mimetype = "image/gif"
    else:
        mimetype = "application/octet-stream"

    return HttpResponse(pictureBinary, content_type=mimetype)








############################################################
# _percent (helper)
############################################################
#
# '0.42' → '42%'. Coordinates are stored as fractions of the
# image size and multiplied by 101 (not 100) on purpose —
# the frontend positions its overlays with these slightly
# inflated percentages. NULL stays NULL.
#
# Used by:
#   - picture_links (below), GET branch
############################################################

def _percent(value):
    if value is None:
        return None
    return f"{int(float(value) * 101)}%"








############################################################
# picture_links
############################################################
#
# GET  /api/phishingpictures/<id>/links — the clickable URL
#      areas of the image, coordinates as CSS percentages.
# POST /api/phishingpictures/<id>/links — replaces ALL areas
#      with the submitted set (the editor always sends the
#      full list).
#
# The links hang off the IMAGE (see models.py), but the API
# addresses them by question ID — that is what the frontend
# has on hand.
#
# Used by:
#   - TestHome.jsx               — tooltip overlays during the test
#   - InteractiveImageEditor.jsx — the admin area editor (POST)
#   - QuestionsList.jsx          — preview in the bank editor
############################################################

@login_required
def picture_links(request, questionID):
    image = _resolve_image(questionID)


    if request.method == "GET":
        return JsonResponse([
            {
                "id": link.id,
                "url": link.content,
                "x": _percent(link.x),
                "y": _percent(link.y),
                "width": _percent(link.w),
                "height": _percent(link.h),
            }
            for link in image.links.order_by("id")
        ], safe=False)


    elif request.method == "POST":
        if not request.current_user.admin:
            return HttpResponse("Error: Not Admin")
        postData = get_json(request)
        if postData is None:
            return HttpResponse("Error: Invalid request body", status=400)

        # Full replace: wipe the image's areas and recreate them
        # from the submitted list
        if "areas" in postData:
            image.links.all().delete()
            for areaData in postData["areas"]:
                QuestionLink.objects.create(
                    image=image,
                    title="",
                    content=areaData["url"],
                    x=str(areaData["x"]),
                    y=str(areaData["y"]),
                    w=str(areaData["width"]),
                    h=str(areaData["height"]),
                )

        return HttpResponse("OK")
