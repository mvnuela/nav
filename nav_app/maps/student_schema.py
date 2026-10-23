"""Task JSON schema loading and the lenient schema for student solutions.

The student schema is derived from the task schema at call time, so format
rules (ranges, patterns, precision) can never drift apart. The only relaxation
is that a row needs just its `id`; every field that IS filled keeps the task
schema's rules.
"""
import copy
import json
import math
import os

from django.conf import settings
from jsonschema import Draft202012Validator, ValidationError, validators


def load_task_schema():
    schema_path = os.path.join(settings.BASE_DIR, "navigation-task.schema.json")
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _tolerant_multiple_of(validator, multiple_of, instance, schema):
    # jsonschema's own multipleOf does float division and rejects values such
    # as 18.7826 for 0.0001; accept a quotient within 1e-6 of an integer.
    if not validator.is_type(instance, "number"):
        return
    try:
        quotient = instance / multiple_of
    except OverflowError:  # an int too large for a float, e.g. a 400-digit literal
        quotient = math.inf
    if not math.isfinite(quotient):
        # round() below would raise on NaN / Infinity / 1e308-sized quotients.
        yield ValidationError(f"{instance} is not a usable number")
        return
    if abs(quotient - round(quotient)) >= 1e-6:
        yield ValidationError(f"{instance} is not a multiple of {multiple_of}")


_TolerantValidator = validators.extend(
    Draft202012Validator, {"multipleOf": _tolerant_multiple_of}
)


def make_validator(schema):
    return _TolerantValidator(schema)


def student_solution_schema():
    task = load_task_schema()
    defs = task["$defs"]

    poi = copy.deepcopy(defs["poi_item"])
    poi["required"] = ["id"]

    trk = copy.deepcopy(defs["trk_point"])
    trk["required"] = ["id"]
    trk["properties"]["position"]["required"] = []

    return {
        "$schema": task["$schema"],
        "type": "object",
        "additionalProperties": False,
        "required": ["task_id", "task_title", "poi", "solution"],
        "properties": {
            "task_id": {"type": "integer", "minimum": 1},
            "task_title": {"type": "string"},
            "poi": {"type": "array", "items": {"$ref": "#/$defs/student_poi_item"}},
            "solution": {
                "type": "object",
                "additionalProperties": False,
                "required": ["trk", "comment"],
                "properties": {
                    "trk": {"type": "array", "items": {"$ref": "#/$defs/student_trk_point"}},
                    "comment": {"type": ["string", "null"]},
                },
            },
        },
        "$defs": {
            **copy.deepcopy(defs),
            "student_poi_item": poi,
            "student_trk_point": trk,
        },
    }


def validate_student_solution(data):
    """Return a list of "<path>: <message>" errors; empty means valid."""
    validator = make_validator(student_solution_schema())
    errors = sorted(validator.iter_errors(data), key=lambda e: list(map(str, e.absolute_path)))
    return [
        f"{'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message}"
        for e in errors
    ]
