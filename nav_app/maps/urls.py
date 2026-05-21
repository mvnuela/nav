from django.urls import path
from .views import (
    index,
    sea_map,
    custom_map,
    enhanced_graticule,
    navigation_task_form,
    convert_pdf_to_image,
    task_list,
    task_upload,
    task_download,
)

app_name = 'maps'

urlpatterns = [
    path('', index, name='index'),
    path('sea-map/', sea_map, name='sea_map'),
    path('custom-map/', custom_map, name='custom_map'),
    path('enhanced-graticule/', enhanced_graticule, name='enhanced_graticule'),
    path('navigation-task/', navigation_task_form, name='navigation_task_form'),
    path('tasks/', task_list, name='task_list'),
    path('tasks/upload/', task_upload, name='task_upload'),
    path('tasks/<int:pk>/download/', task_download, name='task_download'),
    path('api/convert-pdf/', convert_pdf_to_image, name='convert_pdf'),
]
