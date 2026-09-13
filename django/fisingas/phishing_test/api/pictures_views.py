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



from django.http import Http404, HttpResponse, JsonResponse

import math

from fisingas.common.timestamps import now
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

    if "." not in file.name or file.name.rsplit(".", 1)[1].lower() not in ALLOWED_EXTENSIONS:
        return JsonResponse({"type": "error", "reason": "File type not allowed"}, status=400)

    # (Django never hands over a part with an empty filename, so
    # there is no "no selected file" case to check — but an empty
    # FILE is possible and must not become a question)
    if file.size == 0:
        return JsonResponse({"type": "error", "reason": "Empty file"}, status=400)

    # Size is checked BEFORE reading — an oversized upload is
    # refused without ever pulling its bytes into memory
    if file.size > 5 * 1024 * 1024:  # 5MB
        return JsonResponse({"type": "error", "reason": "File is too large"}, status=400)

    file_binary = file.read()

    # The BYTES decide, not the filename: only what get_picture can
    # serve as an image may become a question — a renamed text file
    # would be stored forever and served back from this origin
    if _sniff_mimetype(file_binary) is None:
        return JsonResponse({"type": "error", "reason": "File is not an image"}, status=400)

    timeNow = now()

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
# _resolve_image_id resolves the ID only — never the blob.
# The links endpoint is called once per question per student
# and needs nothing but the ID, so pulling a multi-megabyte
# bytea through Postgres for it would be pure waste.
# _resolve_image loads the row; get_picture is its only user.
#
# Used by:
#   - get_picture (below)    — _resolve_image
#   - picture_links (below)  — _resolve_image_id
############################################################

def _resolve_image_id(questionID):
    image_id = Question.objects.filter(id=questionID).values_list("image_id", flat=True).first()
    if image_id is None:
        image_id = (
            Answer.objects
            .filter(question_id=questionID, image__isnull=False)
            .values_list("image_id", flat=True)
            .first()
        )
    if image_id is None:
        raise Http404
    return image_id


def _resolve_image(questionID):
    return QuestionImage.objects.get(id=_resolve_image_id(questionID))








############################################################
# _sniff_mimetype (helper)
############################################################
#
# The image type from the magic bytes, or None when the bytes
# are not one of the three formats the platform accepts. The
# same table validates an upload and labels the served blob.
#
# Used by:
#   - upload_picture (above) — refuses anything else
#   - get_picture (below)    — the Content-Type
############################################################

def _sniff_mimetype(binary):
    if binary[0:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if binary[0:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if binary[0:3] == b"GIF":
        return "image/gif"
    return None








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

    # Uploads are validated by their bytes, so the fallback only
    # ever applies to rows stored before that check existed
    mimetype = _sniff_mimetype(pictureBinary) or "application/octet-stream"

    return HttpResponse(pictureBinary, content_type=mimetype)








############################################################
# _percent (helper)
############################################################
#
# '0.42' → '42%'. Coordinates are stored as fractions of the
# image size; the percent is ROUNDED, never truncated — 0.29*100
# is 28.999… in floating point, and the editor round-trips the
# value on every save, so a truncating conversion would creep
# by a percent per save.
# NULL stays NULL.
#
# Used by:
#   - picture_links (below), GET branch
############################################################

def _percent(value):
    # A stored value that cannot be parsed renders as null
    # instead of taking the whole GET down
    if value is None:
        return None
    try:
        return f"{round(float(value) * 100)}%"
    except (TypeError, ValueError):
        return None


def _is_area(area):
    # One submitted rectangle: an object with a URL and four finite
    # numeric coordinates (fractions of the image size)
    if not isinstance(area, dict) or not isinstance(area.get("url"), str):
        return False
    for key in ("x", "y", "width", "height"):
        value = area.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            return False
    return True








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
    image_id = _resolve_image_id(questionID)


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
            for link in QuestionLink.objects.filter(image_id=image_id).order_by("id")
        ], safe=False)


    elif request.method == "POST":
        if not request.current_user.admin:
            return HttpResponse("Error: Not Admin")
        postData = get_json(request)
        if not isinstance(postData, dict):
            return HttpResponse("Error: Invalid request body", status=400)

        # Full replace: wipe the image's areas and recreate them
        # from the submitted list — validated as a whole first, so a
        # bad rectangle (a null or non-numeric coordinate would be
        # stored as text and break every later GET) refuses the
        # request and touches nothing
        if "areas" in postData:
            areas = postData["areas"]
            if not isinstance(areas, list) or not all(_is_area(area) for area in areas):
                return HttpResponse("Error: Invalid request body", status=400)

            QuestionLink.objects.filter(image_id=image_id).delete()
            for areaData in areas:
                QuestionLink.objects.create(
                    image_id=image_id,
                    title="",
                    content=areaData["url"],
                    x=str(areaData["x"]),
                    y=str(areaData["y"]),
                    w=str(areaData["width"]),
                    h=str(areaData["height"]),
                )

        return HttpResponse("OK")

    return HttpResponse(status=405)
