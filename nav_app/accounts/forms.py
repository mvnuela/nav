from django import forms
from django.contrib.auth.forms import UserCreationForm

from .models import Invitation, User


class InviteAcceptForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username",)


class InvitationCreateForm(forms.ModelForm):
    class Meta:
        model = Invitation
        fields = ("role", "note")
        widgets = {
            "role": forms.RadioSelect,
        }