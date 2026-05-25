from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.generic import CreateView, ListView

from .forms import InvitationCreateForm, InviteAcceptForm
from .models import Invitation


class TeacherRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        user = self.request.user
        return user.is_authenticated and user.is_teacher


class InvitationListView(TeacherRequiredMixin, ListView):
    model = Invitation
    template_name = "accounts/invitation_list.html"
    context_object_name = "invitations"

    def get_queryset(self):
        return Invitation.objects.filter(created_by=self.request.user)


class InvitationCreateView(TeacherRequiredMixin, CreateView):
    form_class = InvitationCreateForm
    template_name = "accounts/invitation_form.html"
    success_url = reverse_lazy("accounts:invitation_list")

    def form_valid(self, form):
        form.instance.created_by = self.request.user
        response = super().form_valid(form)
        messages.success(
            self.request,
            f"Invitation link created. Share it with the new {self.object.get_role_display().lower()}.",
        )
        return response


def _get_redeemable_invitation_or_404(token: str) -> Invitation:
    invitation = get_object_or_404(Invitation, token=token)
    if not invitation.is_redeemable:
        raise Http404("This invitation is no longer valid.")
    return invitation


class InviteAcceptView(CreateView):
    form_class = InviteAcceptForm
    template_name = "registration/invite_accept.html"
    success_url = reverse_lazy("maps:index")

    def dispatch(self, request, *args, **kwargs):
        self.invitation = _get_redeemable_invitation_or_404(kwargs["token"])
        if request.user.is_authenticated:
            return redirect("maps:index")
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["invitation"] = self.invitation
        return ctx

    def form_valid(self, form):
        user = form.save(commit=False)
        user.role = self.invitation.role
        user.save()
        self.object = user
        self.invitation.mark_used(user)
        login(self.request, user)
        return redirect(self.get_success_url())


@login_required
def invitation_revoke(request, pk):
    if request.method != "POST":
        return redirect("accounts:invitation_list")
    invitation = get_object_or_404(
        Invitation, pk=pk, created_by=request.user
    )
    if invitation.is_redeemable:
        invitation.expires_at = invitation.created_at
        invitation.save(update_fields=("expires_at",))
        messages.info(request, "Invitation revoked.")
    return redirect("accounts:invitation_list")