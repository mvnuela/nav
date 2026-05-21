from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "owner", "created_at", "updated_at")
    list_filter = ("created_at", "owner")
    search_fields = ("title", "author", "description")
    readonly_fields = ("created_at", "updated_at")
