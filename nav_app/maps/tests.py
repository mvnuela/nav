import json
from pathlib import Path

from django.test import TestCase, override_settings
from django.urls import reverse

from accounts.models import User
from maps.models import Task


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

import json
from pathlib import Path

from .student_schema import (
    load_task_schema,
    make_validator,
    student_solution_schema,
    validate_student_solution,
)

TEST_DATA = Path(__file__).resolve().parent / "test_data"


class TaskSchemaRefactorTests(TestCase):
    def test_valid_task_still_validates(self):
        data = json.loads((TEST_DATA / "task_valid.json").read_text())
        self.assertEqual(list(make_validator(load_task_schema()).iter_errors(data)), [])

    def test_task_trk_row_still_requires_all_fields(self):
        data = json.loads((TEST_DATA / "task_valid.json").read_text())
        del data["solution"]["trk"][0]["log_nm"]
        self.assertFalse(make_validator(load_task_schema()).is_valid(data))

    def test_items_live_in_defs(self):
        s = load_task_schema()
        self.assertEqual(s["properties"]["poi"]["items"], {"$ref": "#/$defs/poi_item"})
        self.assertEqual(
            s["properties"]["solution"]["properties"]["trk"]["items"],
            {"$ref": "#/$defs/trk_point"},
        )


class StudentSchemaTests(TestCase):
    def ok(self, **over):  # minimal valid student file
        base = {"task_id": 7, "task_title": "T", "poi": [], "solution": {"trk": [], "comment": None}}
        base.update(over)
        return base

    def test_empty_lists_are_valid(self):
        self.assertEqual(validate_student_solution(self.ok()), [])

    def test_row_with_only_id_is_valid(self):
        d = self.ok(poi=[{"id": "poi-1"}], solution={"trk": [{"id": "trk-1"}], "comment": None})
        self.assertEqual(validate_student_solution(d), [])

    def test_partial_position_is_valid(self):
        d = self.ok(solution={"trk": [{"id": "trk-1", "position": {"lat": 54.5}}], "comment": None})
        self.assertEqual(validate_student_solution(d), [])

    def test_non_finite_numbers_are_errors_not_exceptions(self):
        for bad in (float("inf"), float("-inf"), float("nan"), 1e308):
            errors = validate_student_solution(self.ok(poi=[{"id": "poi-1", "lat": bad}]))
            self.assertTrue(errors, bad)

    def test_huge_integer_is_an_error_not_an_exception(self):
        # json.loads turns a 400-digit literal into an int too large for a float.
        errors = validate_student_solution(self.ok(poi=[{"id": "poi-1", "lat": 10**400}]))
        self.assertTrue(errors)

    def test_filled_field_keeps_format_rules(self):
        d = self.ok(solution={"trk": [{"id": "trk-1", "course_true_deg": 360}], "comment": None})
        errors = validate_student_solution(d)
        self.assertTrue(any("course_true_deg" in e for e in errors))
        self.assertTrue(any(e.startswith("solution/trk/0/course_true_deg") for e in errors))

    def test_four_decimal_values_are_not_rejected(self):
        d = self.ok(
            poi=[{"id": "poi-1", "lat": 54.3721, "lon": 18.7826}],
            solution={"trk": [{"id": "trk-1", "log_nm": 1.2345}], "comment": None},
        )
        self.assertEqual(validate_student_solution(d), [])

    def test_five_decimal_values_are_rejected(self):
        d = self.ok(poi=[{"id": "poi-1", "lat": 54.37215}])
        self.assertNotEqual(validate_student_solution(d), [])

    def test_teacher_file_is_rejected(self):
        d = self.ok()
        d["task"] = {}
        self.assertNotEqual(validate_student_solution(d), [])

    def test_missing_task_id_is_rejected(self):
        d = self.ok()
        del d["task_id"]
        errors = validate_student_solution(d)
        self.assertNotEqual(errors, [])
        self.assertTrue(errors[0].startswith("(root)"))

    def test_student_rules_follow_task_schema(self):
        # no drift: lenient rows have the same properties as the strict ones
        s, t = student_solution_schema()["$defs"], load_task_schema()["$defs"]
        self.assertEqual(s["student_poi_item"]["properties"], t["poi_item"]["properties"])
        st, tt = s["student_trk_point"]["properties"], t["trk_point"]["properties"]
        self.assertEqual(st.keys(), tt.keys())
        for key in tt:
            if key != "position":
                self.assertEqual(st[key], tt[key], key)
        self.assertEqual(st["position"]["properties"], tt["position"]["properties"])
        self.assertEqual(st["position"]["required"], [])

    def test_task_schema_is_not_mutated(self):
        student_solution_schema()
        t = load_task_schema()["$defs"]["trk_point"]
        self.assertIn("id", t["required"])
        self.assertEqual(len(t["required"]), 10)


TEST_STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


@override_settings(STORAGES=TEST_STORAGES)
class StudentSolutionPageTests(TestCase):
    """The student's solution page: no calculators, never the teacher's answer."""

    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create_user(
            username="teacher", password="pw", role=User.Role.TEACHER
        )
        cls.student = User.objects.create_user(
            username="jkowalski", password="pw", role=User.Role.STUDENT
        )
        path = Path(__file__).parent / "test_data" / "task_valid.json"
        cls.payload = json.loads(path.read_text(encoding="utf-8"))
        cls.task = Task.objects.create(
            owner=cls.teacher,
            title="Gdansk Bay exercise",
            description="d",
            author="A. Teacher",
            payload=cls.payload,
        )
        cls.url = reverse("maps:task_student_solution", args=[cls.task.pk])

    def test_student_gets_page_with_title(self):
        self.client.force_login(self.student)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Gdansk Bay exercise")

    def test_teacher_is_forbidden(self):
        self.client.force_login(self.teacher)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_anonymous_redirected(self):
        self.assertEqual(self.client.get(self.url).status_code, 302)

    def test_missing_task_is_404(self):
        self.client.force_login(self.student)
        url = reverse("maps:task_student_solution", args=[self.task.pk + 999])
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_page_never_contains_teacher_solution(self):
        self.client.force_login(self.student)
        body = self.client.get(self.url).content.decode()
        solution = self.payload["solution"]
        self.assertNotIn(solution["comment"], body)
        for point in solution["trk"]:
            self.assertNotIn(point["id"], body)
            self.assertNotIn(point["position"]["position_txt"], body)
        for poi in self.payload["poi"]:
            self.assertNotIn(poi["id"], body)

    def test_page_loads_no_calculators(self):
        self.client.force_login(self.student)
        body = self.client.get(self.url).content.decode()
        for marker in ("calculators/", "course_chain.js", "calc-btn", "calcSidebar"):
            self.assertNotIn(marker, body)

    def test_context_json(self):
        self.client.force_login(self.student)
        response = self.client.get(self.url)
        self.assertEqual(response.context["student_context"], {
            "task_id": self.task.pk,
            "task_title": "Gdansk Bay exercise",
            "tz_offset": self.payload["task"]["navigation"]["timezone"]["offset"],
            "login": "jkowalski",
        })
        self.assertContains(response, 'id="studentContext"')
        self.assertContains(response, 'id="studentSchema"')

    def test_task_list_links_student_to_form(self):
        self.client.force_login(self.student)
        self.assertContains(self.client.get(reverse("maps:task_list")), self.url)
        self.client.force_login(self.teacher)
        self.assertNotContains(self.client.get(reverse("maps:task_list")), self.url)


from .solution_compare import pair_rows, cell


class SolutionCompareHelpersTests(TestCase):
    def test_pair_rows_pads_the_shorter_side(self):
        self.assertEqual(
            pair_rows([{"id": "a"}], [{"id": "x"}, {"id": "y"}]),
            [({"id": "a"}, {"id": "x"}), (None, {"id": "y"})],
        )

    def test_cell_dash_for_missing(self):
        self.assertEqual(cell(None, "log_nm"), "—")
        self.assertEqual(cell({"id": "trk-1"}, "log_nm"), "—")
        self.assertEqual(cell({"id": "trk-1", "log_nm": None}, "log_nm"), "—")

    def test_cell_dash_for_empty_string(self):
        self.assertEqual(cell({"description": ""}, "description"), "—")

    def test_cell_plain_value(self):
        self.assertEqual(cell({"log_nm": 0.0}, "log_nm"), "0.0")

    def test_cell_position_prefers_text(self):
        row = {"position": {"lat": 54.5, "lon": 18.5, "position_txt": "54 30 N"}}
        self.assertEqual(cell(row, "position"), "54 30 N")

    def test_cell_position_falls_back_to_lat_lon(self):
        row = {"position": {"lat": 54.5, "lon": 18.5}}
        self.assertEqual(cell(row, "position"), "54.5, 18.5")

    def test_cell_partial_position(self):
        self.assertEqual(cell({"position": {"lat": 54.5}}, "position"), "54.5, —")
        self.assertEqual(cell({"position": {"lon": 18.5}}, "position"), "—, 18.5")
        self.assertEqual(cell({"position": {}}, "position"), "—")

    def test_cell_poi_position(self):
        self.assertEqual(cell({"lat": 54.5, "lon": 18.5}, "position"), "54.5, 18.5")
        self.assertEqual(cell({"id": "p"}, "position"), "—")


@override_settings(STORAGES=TEST_STORAGES)
class TaskCompareViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create_user(
            username="teacher", password="pw", role=User.Role.TEACHER
        )
        cls.student = User.objects.create_user(
            username="jkowalski", password="pw", role=User.Role.STUDENT
        )
        path = Path(__file__).parent / "test_data" / "task_valid.json"
        cls.payload = json.loads(path.read_text(encoding="utf-8"))
        cls.task = Task.objects.create(
            owner=cls.teacher, title="Gdansk Bay exercise", description="d",
            author="A. Teacher", payload=cls.payload,
        )
        cls.url = reverse("maps:task_compare")

    def upload(self, content, name="kowalski_task-1.json"):
        from django.core.files.uploadedfile import SimpleUploadedFile
        if not isinstance(content, bytes):
            content = json.dumps(content).encode("utf-8")
        return self.client.post(self.url, {"student_file": SimpleUploadedFile(name, content)})

    def student_file(self, **overrides):
        data = {
            "task_id": self.task.pk,
            "task_title": "Gdansk Bay exercise",
            "poi": [{"id": "poi-1", "name": "StudentPoiName", "lat": 54.5, "lon": 18.5}],
            "solution": {
                "trk": [{"id": "trk-1", "time": "2026-06-01T11:00:00+02:00",
                         "position": {"lat": 54.5, "lon": 18.5, "position_txt": "StudentPosTxt"},
                         "log_nm": 7.5}],
                "comment": None,
            },
        }
        data.update(overrides)
        return data

    def test_student_is_forbidden(self):
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.upload(self.student_file()).status_code, 403)

    def test_huge_number_gives_readable_error_not_500(self):
        self.client.force_login(self.teacher)
        data = self.student_file(poi=[{"id": "poi-1", "lat": 1e308}])
        response = self.upload(data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "poi/0/lat")

    def test_huge_integer_gives_readable_error_not_500(self):
        self.client.force_login(self.teacher)
        raw = (b'{"task_id": 1, "task_title": "T", "poi": [{"id": "poi-1", "lat": 1'
               + b"0" * 400
               + b'}], "solution": {"trk": [], "comment": null}}')
        response = self.upload(raw)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "poi/0/lat")

    def test_bare_nan_gives_readable_error_not_500(self):
        self.client.force_login(self.teacher)
        raw = (b'{"task_id": 1, "task_title": "T", "poi": [{"id": "poi-1", "lat": NaN}],'
               b' "solution": {"trk": [], "comment": null}}')
        response = self.upload(raw)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "not a JSON file")

    def test_anonymous_redirected(self):
        self.assertEqual(self.client.get(self.url).status_code, 302)

    def test_teacher_sees_upload_form(self):
        self.client.force_login(self.teacher)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="student_file"')

    def test_post_without_file_shows_message(self):
        self.client.force_login(self.teacher)
        response = self.client.post(self.url, {})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Choose a file")

    def test_not_json_shows_message(self):
        self.client.force_login(self.teacher)
        response = self.upload(b"\xff\xfe nonsense")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "not a JSON file")

    def test_teacher_file_is_rejected_with_message(self):
        self.client.force_login(self.teacher)
        response = self.upload(self.payload)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "task_id")

    def test_schema_errors_limited_to_ten(self):
        self.client.force_login(self.teacher)
        poi = [{"id": f"p{i}", "lat": 999} for i in range(15)]
        response = self.upload(self.student_file(poi=poi))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["errors"]), 10)

    def test_unknown_task_id_shows_message(self):
        self.client.force_login(self.teacher)
        response = self.upload(self.student_file(task_id=99999))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "no task with id 99999")

    def test_valid_file_renders_both_solutions(self):
        self.client.force_login(self.teacher)
        name = f"kowalski_task-{self.task.pk}.json"
        response = self.upload(self.student_file(), name=name)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Gdansk Bay exercise")
        self.assertContains(response, name)
        self.assertContains(response, "54.3721 N 18.7826 E")
        self.assertContains(response, "StudentPosTxt")
        self.assertContains(response, "StudentPoiName")
        self.assertContains(response, "Teacher comment")

    def test_uneven_rows_render(self):
        self.client.force_login(self.teacher)
        response = self.upload(self.student_file())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["trk_pairs"]), 3)
        self.assertContains(response, "—")

    def test_nothing_is_saved(self):
        import os
        from django.conf import settings
        self.client.force_login(self.teacher)
        before = Task.objects.count()
        media = str(settings.MEDIA_ROOT)
        files_before = sorted(os.listdir(media)) if os.path.isdir(media) else []
        self.upload(self.student_file())
        files_after = sorted(os.listdir(media)) if os.path.isdir(media) else []
        self.assertEqual(Task.objects.count(), before)
        self.assertEqual(files_before, files_after)


@override_settings(STORAGES=TEST_STORAGES)
class TaskCompareTemplateTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create_user(
            username="teacher", password="pw", role=User.Role.TEACHER
        )
        cls.student = User.objects.create_user(
            username="jkowalski", password="pw", role=User.Role.STUDENT
        )
        path = Path(__file__).parent / "test_data" / "task_valid.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["task"]["navigation"]["compass_deviation_table"] = [
            {"heading_deg": 0, "deviation_deg": 7.25}
        ]
        payload["solution"]["trk"][1]["log_nm"] = 111.5
        cls.task = Task.objects.create(
            owner=cls.teacher, title="Gdansk Bay exercise", description="d",
            author="A. Teacher", payload=payload,
        )
        cls.url = reverse("maps:task_compare")

    def compare(self, trk=None, comment="Student remark"):
        from django.core.files.uploadedfile import SimpleUploadedFile
        data = {
            "task_id": self.task.pk,
            "task_title": "Gdansk Bay exercise",
            "poi": [],
            "solution": {
                "trk": trk if trk is not None else [
                    {"id": "trk-1", "log_nm": 0.0},
                    {"id": "trk-2", "log_nm": 222.5},
                ],
                "comment": comment,
            },
        }
        self.client.force_login(self.teacher)
        return self.client.post(self.url, {"student_file": SimpleUploadedFile(
            "kowalski_task-1.json", json.dumps(data).encode("utf-8"))})

    def test_header_names_file_and_task(self):
        response = self.compare()
        self.assertContains(response, "kowalski_task-1.json")
        self.assertContains(response, "Gdansk Bay exercise")
        self.assertContains(response, "Teacher (reference)")
        self.assertContains(response, "Student")

    def test_task_data_only_on_teacher_side(self):
        response = self.compare()
        self.assertContains(response, "7.25")
        self.assertContains(response, "Same as the left")
        self.assertContains(response, "CEST")

    def test_task_data_tolerates_missing_optional_parts(self):
        self.task.payload["task"]["navigation"].pop("magnetic_variation_list", None)
        self.task.payload["task"].pop("meta", None)
        self.task.save()
        self.assertEqual(self.compare().status_code, 200)

    def test_trk_rows_share_one_table_row(self):
        import re
        html = self.compare().content.decode()
        rows = re.findall(r"<tr\b.*?</tr>", html, re.S)
        self.assertTrue(
            any("111.5" in r and "222.5" in r for r in rows),
            "teacher and student trk-2 values must sit in one <tr>",
        )

    def test_comments_shown(self):
        response = self.compare()
        self.assertContains(response, "Teacher comment")
        self.assertContains(response, "Student remark")

    def test_no_calculators_or_solution_leak(self):
        response = self.compare()
        self.assertNotContains(response, "calc-btn")
        self.assertNotContains(response, "calculator_js")

    def test_teacher_task_list_links_to_compare(self):
        self.client.force_login(self.teacher)
        self.assertContains(self.client.get(reverse("maps:task_list")), self.url)
        self.client.force_login(self.student)
        self.assertNotContains(self.client.get(reverse("maps:task_list")), self.url)


@override_settings(STORAGES=TEST_STORAGES)
class TaskUploadValidationTests(TestCase):
    """task_upload uses the tolerant validator: plain jsonschema rejects 18.7826."""

    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create_user(
            username="teacher", password="pw", role=User.Role.TEACHER
        )
        cls.url = reverse("maps:task_upload")

    def upload(self, content):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_login(self.teacher)
        return self.client.post(self.url, {"file": SimpleUploadedFile("task.json", content)})

    def test_four_decimal_values_are_accepted(self):
        content = (TEST_DATA / "task_valid.json").read_bytes()
        self.assertIn(b"18.7826", content)
        response = self.upload(content)
        self.assertRedirects(response, reverse("maps:task_list"))
        self.assertEqual(Task.objects.count(), 1)

    def test_huge_integer_gives_readable_error_not_500(self):
        data = json.loads((TEST_DATA / "task_valid.json").read_text())
        raw = json.dumps(data).replace("18.7826", "1" + "0" * 400, 1).encode("utf-8")
        response = self.upload(raw)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "does not match the navigation-task schema")
        self.assertEqual(Task.objects.count(), 0)
