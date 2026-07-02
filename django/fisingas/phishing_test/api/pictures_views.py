############################################################
#  [*] Question picture endpoints
#
#    POST /api/phishingpictures            — upload → new question
#    GET  /api/phishingpictures/<id>       — the image bytes
#    GET  /api/phishingpictures/<id>/links — clickable areas
#    POST /api/phishingpictures/<id>/links — replace the areas
############################################################


from datetime import datetime

from django.http import Http404, HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from ..models import Answer, Question, QuestionImage, QuestionLink


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}




@login_required
def upload_picture(request):
    """POST /api/phishingpictures — multipart 'image' creates an empty question."""
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

    Question.objects.create(
        is_enabled=1,
        points=1,
        is_phishing=0,
        question="",
        filename="",
        image=image,
        picture_height=0,
        picture_width=0,
        created=timeNow,
    )

    return JsonResponse({"type": "ok", "message": "Image uploaded successfully"})




def _resolve_image(questionID):
    """
    The QuestionImage behind a question bank ID. When the question
    still exists its image is used directly; when it was deleted,
    the image is found through the frozen answer snapshots that
    link to it — so old graded tests keep their pictures (and the
    tooltips attached to them) forever.
    """
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




@login_required
def get_picture(request, questionID):
    """GET /api/phishingpictures/<id> — raw image bytes, mimetype sniffed."""
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




def _percent(value):
    """'0.42' → '42%' — CAST(X * 101 AS INTEGER) || '%', NULL stays NULL."""
    if value is None:
        return None
    return f"{int(float(value) * 101)}%"




@login_required
def picture_links(request, questionID):
    """
    GET/POST /api/phishingpictures/<id>/links — the clickable URL
    areas. The links hang off the IMAGE (see models.py), but the
    API keeps addressing them by question ID like Flask did.
    """
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
