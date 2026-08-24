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


class CalculatorTemplateTests(TestCase):
    """Regression tests for where the calculator panels are rendered.

    The calculators now live on the navigation task form alone; the sea map
    and the enhanced graticule dropped them. Neither page may emit their
    markup or their script URLs for anyone — a leftover panel there would be
    a dead control firing forbidden requests. The request-layer gating of the
    scripts themselves is covered by CalculatorJsAccessTests.
    """

    PANEL_IDS = ("fixCalculatorPanel", "runfixCalculatorPanel", "courseCalculatorPanel")

    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create_user(
            username="teacher", password="pw", role=User.Role.TEACHER
        )
        cls.student = User.objects.create_user(
            username="student", password="pw", role=User.Role.STUDENT
        )
        # The gated script src the task form emits.
        cls.script_url = reverse("maps:calculator_js", args=["fix/fix_core.js"])
        cls.task_form_url = reverse("maps:navigation_task_form")
        cls.sea_map_url = reverse("maps:sea_map")
        cls.graticule_url = reverse("maps:enhanced_graticule")

    def assertNoCalculators(self, response):
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, self.script_url)
        for panel_id in self.PANEL_IDS:
            self.assertNotContains(response, panel_id)

    def test_task_form_carries_the_calculators_for_teacher(self):
        self.client.force_login(self.teacher)
        response = self.client.get(self.task_form_url)
        self.assertContains(response, self.script_url)
        for panel_id in self.PANEL_IDS:
            self.assertContains(response, panel_id)

    def test_sea_map_has_no_calculators_for_student(self):
        self.client.force_login(self.student)
        self.assertNoCalculators(self.client.get(self.sea_map_url))

    def test_sea_map_has_no_calculators_for_teacher(self):
        self.client.force_login(self.teacher)
        self.assertNoCalculators(self.client.get(self.sea_map_url))

    def test_graticule_has_no_calculators_for_student(self):
        self.client.force_login(self.student)
        self.assertNoCalculators(self.client.get(self.graticule_url))

    def test_graticule_has_no_calculators_for_teacher(self):
        self.client.force_login(self.teacher)
        self.assertNoCalculators(self.client.get(self.graticule_url))