from django.test import TestCase
from django.urls import reverse

from accounts.models import User


class CalculatorJsAccessTests(TestCase):
    """Regression tests for the teacher-only `calculator_js` view.

    Navigation-calculator JS lives outside the static tree and is served only
    through this view, so the role gating must hold at the request layer:
    teachers get the file (200), everyone else is refused.
    """

    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create_user(
            username="teacher", password="pw", role=User.Role.TEACHER
        )
        cls.student = User.objects.create_user(
            username="student", password="pw", role=User.Role.STUDENT
        )
        # A real calculator script that exists on disk under private_js/.
        cls.url = reverse("maps:calculator_js", args=["fix/fix_core.js"])

    def test_teacher_gets_the_script(self):
        self.client.force_login(self.teacher)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/javascript")
        body = b"".join(response.streaming_content)
        self.assertIn(b"window.Fix", body)

    def test_student_is_forbidden(self):
        self.client.force_login(self.student)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_anonymous_is_redirected_to_login(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 302)

    def test_teacher_path_traversal_is_blocked(self):
        self.client.force_login(self.teacher)
        response = self.client.get(reverse("maps:calculator_js", args=["../../views.py"]))
        self.assertEqual(response.status_code, 404)

    def test_teacher_missing_file_is_404(self):
        self.client.force_login(self.teacher)
        response = self.client.get(reverse("maps:calculator_js", args=["fix/nope.js"]))
        self.assertEqual(response.status_code, 404)


class CalculatorTemplateGatingTests(TestCase):
    """Regression tests for the template-layer half of the gating.

    Even though the view refuses students at the request layer, the map pages
    must not render the calculator panels or load their scripts for students —
    otherwise they would see dead controls and fire forbidden requests.
    """

    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create_user(
            username="teacher", password="pw", role=User.Role.TEACHER
        )
        cls.student = User.objects.create_user(
            username="student", password="pw", role=User.Role.STUDENT
        )
        # The gated script src that the templates emit only for teachers.
        cls.script_url = reverse("maps:calculator_js", args=["fix/fix_core.js"])
        cls.sea_map_url = reverse("maps:sea_map")
        cls.graticule_url = reverse("maps:enhanced_graticule")

    def test_sea_map_hides_calculator_scripts_from_student(self):
        self.client.force_login(self.student)
        response = self.client.get(self.sea_map_url)
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, self.script_url)

    def test_sea_map_shows_calculator_scripts_to_teacher(self):
        self.client.force_login(self.teacher)
        response = self.client.get(self.sea_map_url)
        self.assertContains(response, self.script_url)

    def test_graticule_hides_calculators_from_student(self):
        self.client.force_login(self.student)
        response = self.client.get(self.graticule_url)
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, self.script_url)
        # The static calculator panels must be gone too.
        self.assertNotContains(response, "fixCalculatorPanel")
        self.assertNotContains(response, "runfixCalculatorPanel")
        self.assertNotContains(response, "courseCalculatorPanel")

    def test_graticule_shows_calculators_to_teacher(self):
        self.client.force_login(self.teacher)
        response = self.client.get(self.graticule_url)
        self.assertContains(response, self.script_url)
        self.assertContains(response, "fixCalculatorPanel")
        self.assertContains(response, "runfixCalculatorPanel")
        self.assertContains(response, "courseCalculatorPanel")