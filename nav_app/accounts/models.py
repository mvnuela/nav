import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.urls import reverse
from django.utils import timezone


def _generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


def _default_invitation_expiry():
    return timezone.now() + timedelta(days=Invitation.DEFAULT_LIFETIME_DAYS)


class User(AbstractUser):
    class Role(models.TextChoices):
        TEACHER = "teacher", "Teacher"
        STUDENT = "student", "Student"

    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.STUDENT,
    )

    @property
    def is_teacher(self) -> bool:
        return self.role == self.Role.TEACHER


class Invitation(models.Model):
    DEFAULT_LIFETIME_DAYS = 14

    token = models.CharField(
        max_length=64,
        unique=True,
        default=_generate_invitation_token,
        editable=False,
    )
    role = models.CharField(max_length=16, choices=User.Role.choices)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="invitations_sent",
    )
    note = models.CharField(
        max_length=120,
        blank=True,
        help_text="Optional label to remember who this invite is for.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_default_invitation_expiry)
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitation_used",
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        label = self.note or self.token[:8]
        return f"{self.get_role_display()} invite ({label})"

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_redeemable(self) -> bool:
        return not self.is_used and not self.is_expired

    def get_absolute_url(self) -> str:
        return reverse("accounts:invite_accept", kwargs={"token": self.token})

    def mark_used(self, user: "User") -> None:
        self.used_at = timezone.now()
        self.used_by = user
        self.save(update_fields=("used_at", "used_by"))
