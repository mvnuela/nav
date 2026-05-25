from django.contrib.auth import views as auth_views
from django.urls import path

from .views import (
    InvitationCreateView,
    InvitationListView,
    InviteAcceptView,
    invitation_revoke,
)

app_name = "accounts"

urlpatterns = [
    path("login/", auth_views.LoginView.as_view(), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("invitations/", InvitationListView.as_view(), name="invitation_list"),
    path("invitations/new/", InvitationCreateView.as_view(), name="invitation_create"),
    path("invitations/<int:pk>/revoke/", invitation_revoke, name="invitation_revoke"),
    path("invite/<str:token>/", InviteAcceptView.as_view(), name="invite_accept"),
]
