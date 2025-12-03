from django.urls import path
from .views import index, sea_map, custom_map, convert_pdf_to_image

app_name = 'maps'

urlpatterns = [
    path('', index, name='index'),
    path('sea-map/', sea_map, name='sea_map'),
    path('custom-map/', custom_map, name='custom_map'),
    path('api/convert-pdf/', convert_pdf_to_image, name='convert_pdf'),
]
