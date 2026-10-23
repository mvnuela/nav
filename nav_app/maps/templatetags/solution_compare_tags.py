from django import template

from ..solution_compare import cell as _cell

register = template.Library()


@register.filter
def cell(row, key):
    """{{ row|cell:"log_nm" }} -- display text of one comparison cell."""
    return _cell(row, key)
