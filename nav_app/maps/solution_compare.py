"""Reading an uploaded student solution and pairing it with the teacher's."""
import json
from itertools import zip_longest

from .models import Task
from .student_schema import validate_student_solution

EMPTY = "—"
MAX_SCHEMA_ERRORS = 10

TRK_COLUMNS = [
    ("time", "Time"),
    ("position", "Position"),
    ("distance_nm", "Distance [nm]"),
    ("log_nm", "Log [nm]"),
    ("course_compass_deg", "Compass course [°]"),
    ("course_true_deg", "True course [°]"),
    ("course_over_ground_deg", "Course over ground [°]"),
    ("wind_true_deg", "True wind [°]"),
    ("wind_true_speed", "True wind speed"),
    ("wind_app_deg", "Apparent wind [°]"),
    ("wind_app_speed", "Apparent wind speed"),
    ("speed_kn", "Speed [kn]"),
]

POI_COLUMNS = [
    ("name", "Name"),
    ("type", "Type"),
    ("position", "Position"),
    ("description", "Description"),
]


def pair_rows(teacher, student):
    """Zip the two row lists, padding the shorter side with None."""
    return list(zip_longest(teacher, student))


def _text(value):
    return EMPTY if value is None or value == "" else str(value)


def cell(row, key):
    """Display text of one cell; EMPTY when the row, key or value is absent.

    "position" is shared by both row kinds: a track row keeps a `position`
    dict (its text wins, else "lat, lon" from what is there); a POI row keeps
    `lat` and `lon` at top level.
    """
    if not row:
        return EMPTY
    if key != "position":
        return _text(row.get(key))
    position = row.get("position")
    if isinstance(position, dict):
        if position.get("position_txt"):
            return str(position["position_txt"])
        lat, lon = position.get("lat"), position.get("lon")
    else:
        lat, lon = row.get("lat"), row.get("lon")
    if lat is None and lon is None:
        return EMPTY
    return f"{_text(lat)}, {_text(lon)}"


def read_student_upload(uploaded_file):
    """Parse and check an uploaded student file, in memory only.

    Returns (data, errors); data is None whenever errors is non-empty.
    """
    def reject_constant(name):
        raise ValueError(f"{name} is not valid JSON")

    try:
        data = json.loads(
            uploaded_file.read().decode("utf-8"), parse_constant=reject_constant
        )
    except (UnicodeDecodeError, ValueError, RecursionError):
        return None, ["The file is not a JSON file."]
    schema_errors = validate_student_solution(data)
    if schema_errors:
        return None, schema_errors[:MAX_SCHEMA_ERRORS]
    if not Task.objects.filter(pk=data["task_id"]).exists():
        return None, [f"The file refers to no task with id {data['task_id']}."]
    return data, []
