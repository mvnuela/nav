from unittest import mock

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.forms import InviteAcceptForm
from accounts.models import Invitation, User


class InviteRedemptionTests(TestCase):
    """Redeeming an invitation must be all-or-nothing and happen once.

    Creating the account and marking the invitation used are two writes; if
    they are not one transaction over a locked invitation row, two requests
    opening the same link can both pass the redeemability check and both
    create an account.
    """

    def setUp(self):
        self.teacher = User.objects.create_user(
            username="teacher", password="pw", role=User.Role.TEACHER
        )
        self.invitation = Invitation.objects.create(
            created_by=self.teacher, role=User.Role.STUDENT
        )
        self.url = reverse(
            "accounts:invite_accept", kwargs={"token": self.invitation.token}
        )

    def _redeem(self, username="kursant"):
        return self.client.post(
            self.url,
            {
                "username": username,
                "password1": "trudne-haslo-123",
                "password2": "trudne-haslo-123",
            },
        )

    def test_redeeming_creates_the_account_and_marks_the_invitation(self):
        response = self._redeem()

        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username="kursant")
        self.assertEqual(user.role, User.Role.STUDENT)
        self.invitation.refresh_from_db()
        self.assertTrue(self.invitation.is_used)
        self.assertEqual(self.invitation.used_by, user)

    def test_second_redemption_of_the_same_link_is_refused(self):
        self._redeem()
        self.client.logout()

        response = self._redeem(username="kursant2")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(User.objects.filter(username="kursant2").exists())

    def test_invitation_used_after_the_first_check_is_refused(self):
        """The race: another request redeems the link while this one is in
        the form. The check in dispatch() has already passed, so only a
        re-check under the row lock can stop the second account."""
        real_is_valid = InviteAcceptForm.is_valid

        def is_valid_then_race(form):
            Invitation.objects.filter(pk=self.invitation.pk).update(
                used_at=timezone.now(), used_by=self.teacher
            )
            return real_is_valid(form)

        with mock.patch.object(InviteAcceptForm, "is_valid", is_valid_then_race):
            response = self._redeem()

        self.assertEqual(response.status_code, 404)
        self.assertFalse(User.objects.filter(username="kursant").exists())

    def test_account_is_rolled_back_when_marking_the_invitation_fails(self):
        with mock.patch.object(
            Invitation, "mark_used", side_effect=RuntimeError("boom")
        ):
            with self.assertRaises(RuntimeError):
                self._redeem()

        self.assertFalse(User.objects.filter(username="kursant").exists())
        self.invitation.refresh_from_db()
        self.assertTrue(self.invitation.is_redeemable)

    def test_expired_link_never_reaches_the_form(self):
        self.invitation.expires_at = self.invitation.created_at
        self.invitation.save(update_fields=("expires_at",))

        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self._redeem().status_code, 404)
        self.assertFalse(User.objects.filter(username="kursant").exists())
