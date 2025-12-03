from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import io
import base64
from PIL import Image
import fitz  # PyMuPDF


def index(request):
    """Landing page with navigation options"""
    return render(request, "maps/index.html")


def sea_map(request):
    """Interactive sea map with OpenStreetMap"""
    context = {
        "lat": 54.5,
        "lon": 18.5
    }
    return render(request, "maps/sea_map.html", context)


def custom_map(request):
    """Custom map with graticule overlay"""
    return render(request, "maps/custom_map.html")


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

