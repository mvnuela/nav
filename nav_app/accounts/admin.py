from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Invitation, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Role", {"fields": ("role",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Role", {"fields": ("role",)}),)
    list_display = UserAdmin.list_display + ("role",)
    list_filter = UserAdmin.list_filter + ("role",)


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = (
        "token",
        "role",
        "created_by",
        "created_at",
        "expires_at",
        "used_at",
        "used_by",
    )
    list_filter = ("role", "created_at", "used_at")
    search_fields = ("token", "note", "created_by__username", "used_by__username")
    readonly_fields = ("token", "created_at", "used_at", "used_by")
