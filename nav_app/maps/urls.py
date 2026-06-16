from django.urls import path
from .views import (
    index,
    sea_map,
    enhanced_graticule,
    navigation_task_form,
    calculator_js,
    convert_pdf_to_image,
    task_list,
    task_upload,
    task_download,
    task_solve_sea_map,
    task_solve_enhanced_graticule,
)

app_name = 'maps'

urlpatterns = [
    path('', index, name='index'),
    path('sea-map/', sea_map, name='sea_map'),
    path('enhanced-graticule/', enhanced_graticule, name='enhanced_graticule'),
    path('navigation-task/', navigation_task_form, name='navigation_task_form'),
    path('calculators/<path:path>', calculator_js, name='calculator_js'),
    path('tasks/', task_list, name='task_list'),
    path('tasks/upload/', task_upload, name='task_upload'),
    path('tasks/<int:pk>/download/', task_download, name='task_download'),
    path('tasks/<int:pk>/solve/sea-map/', task_solve_sea_map, name='task_solve_sea_map'),
    path('tasks/<int:pk>/solve/enhanced-graticule/', task_solve_enhanced_graticule, name='task_solve_enhanced_graticule'),
    path('api/convert-pdf/', convert_pdf_to_image, name='convert_pdf'),
]
