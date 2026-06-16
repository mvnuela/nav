from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.conf import settings
from pathlib import Path
import io
import json
import os
import base64
from PIL import Image
import fitz  # PyMuPDF
from jsonschema import Draft202012Validator

from .models import Task


# Source directory for the navigation-calculator JavaScript. These scripts live
# OUTSIDE the static tree (private_js/, not static/) so collectstatic / WhiteNoise
# never expose them publicly. They are served only through the teacher-only view
# `calculator_js`, so students cannot fetch them even by guessing the URL.
CALCULATORS_DIR = (
    Path(__file__).resolve().parent / "private_js" / "calculators"
).resolve()


def _load_task_schema():
    schema_path = os.path.join(settings.BASE_DIR, "navigation-task.schema.json")
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def index(request):
    """Welcome page for anonymous users, dashboard for logged-in users."""
    if not request.user.is_authenticated:
        return render(request, "maps/welcome.html")
    return render(request, "maps/index.html")


@login_required
def sea_map(request):
    """Interactive sea map with OpenStreetMap"""
    context = {
        "lat": 54.5,
        "lon": 18.5
    }
    return render(request, "maps/sea_map.html", context)


@login_required
def enhanced_graticule(request):
    """Enhanced interactive graticule with region fitting"""
    return render(request, "maps/enhanced_graticule.html")


@login_required
def navigation_task_form(request):
    """Form panel for building a navigation-task JSON from user input."""
    if not request.user.is_teacher:
        return HttpResponseForbidden("Only teachers can access the navigation task builder.")
    return render(request, "maps/navigation_task_form.html", {"schema": _load_task_schema()})


@login_required
def task_list(request):
    """List of all uploaded navigation tasks, visible to every authenticated user."""
    tasks = Task.objects.select_related("owner").all()
    return render(request, "maps/task_list.html", {"tasks": tasks})


@login_required
def task_upload(request):
    """Teacher-only: upload a JSON task file, validate against the schema, save it."""
    if not request.user.is_teacher:
        return HttpResponseForbidden("Only teachers can upload tasks.")

    error = None
    if request.method == "POST":
        uploaded = request.FILES.get("file")
        if not uploaded:
            error = "Please choose a JSON file to upload."
        else:
            try:
                payload = json.loads(uploaded.read().decode("utf-8"))
            except UnicodeDecodeError:
                error = "File must be UTF-8 encoded JSON."
            except json.JSONDecodeError as e:
                error = f"Invalid JSON: {e.msg} (line {e.lineno}, column {e.colno})."
            else:
                validator = Draft202012Validator(_load_task_schema())
                schema_errors = sorted(
                    validator.iter_errors(payload), key=lambda err: list(err.path)
                )
                if schema_errors:
                    error = "JSON does not match the navigation-task schema:\n" + "\n".join(
                        f"  - {'/'.join(map(str, err.path)) or '(root)'}: {err.message}"
                        for err in schema_errors
                    )
                else:
                    meta = payload["task"]["meta"]
                    task = Task.objects.create(
                        owner=request.user,
                        title=meta["title"],
                        description=meta["desc"],
                        author=meta["author"],
                        payload=payload,
                    )
                    messages.success(request, f"Task “{task.title}” uploaded.")
                    return redirect("maps:task_list")

    return render(request, "maps/task_upload.html", {"error": error})


@login_required
def task_solve_sea_map(request, pk):
    """Open the OpenSeaMap panel with a task bound to it."""
    if request.user.is_teacher:
        return HttpResponseForbidden("Teachers cannot solve tasks.")
    task = get_object_or_404(Task, pk=pk)
    return render(request, "maps/sea_map.html", {
        "lat": 54.5,
        "lon": 18.5,
        "task": task,
    })


@login_required
def task_solve_enhanced_graticule(request, pk):
    """Open the Enhanced Graticule panel with a task bound to it."""
    if request.user.is_teacher:
        return HttpResponseForbidden("Teachers cannot solve tasks.")
    task = get_object_or_404(Task, pk=pk)
    return render(request, "maps/enhanced_graticule.html", {"task": task})


@login_required
def task_download(request, pk):
    """Download a task's stored JSON payload."""
    if not request.user.is_teacher:
        return HttpResponseForbidden("Only teachers can download task JSON.")
    task = get_object_or_404(Task, pk=pk)
    response = JsonResponse(task.payload, json_dumps_params={"indent": 2})
    response["Content-Disposition"] = f'attachment; filename="task-{task.pk}.json"'
    return response


@login_required
def calculator_js(request, path):
    """Serve a navigation-calculator JS file to teachers only.

    The calculator scripts are deliberately NOT served by the public static
    handler. Routing them through this view enforces the teacher-only boundary
    server-side, so a student cannot bypass the template gating by requesting
    the file directly.
    """
    if not request.user.is_teacher:
        return HttpResponseForbidden("Navigation calculators are available to teachers only.")

    target = (CALCULATORS_DIR / path).resolve()
    # Reject path traversal, non-JS files, and anything missing.
    try:
        target.relative_to(CALCULATORS_DIR)
    except ValueError:
        raise Http404("Calculator script not found.")
    if target.suffix != ".js" or not target.is_file():
        raise Http404("Calculator script not found.")

    return FileResponse(target.open("rb"), content_type="text/javascript")


@csrf_exempt
def convert_pdf_to_image(request):
    """Convert uploaded PDF to image for map overlay"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    if 'pdf' not in request.FILES:
        return JsonResponse({'error': 'No PDF file provided'}, status=400)
    
    pdf_file = request.FILES['pdf']
    
    try:
        # Read PDF file
        pdf_bytes = pdf_file.read()
        
        # Open PDF with PyMuPDF
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Convert first page to image
        page = pdf_document[0]
        
        # Get page dimensions
        mat = fitz.Matrix(2, 2)  # 2x zoom for better quality
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        pdf_document.close()
        
        return JsonResponse({
            'success': True,
            'image': f'data:image/png;base64,{img_str}',
            'width': img.width,
            'height': img.height
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

