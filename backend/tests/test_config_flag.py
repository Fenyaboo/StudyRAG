"""Task 1.4 — cờ AI_FEATURES_ENABLED. Gồm Property 1 (parse là total function)."""

import os

import pytest
from hypothesis import given, settings as hypothesis_settings, strategies as st
from pydantic import ValidationError

from app.core.config import Settings, get_settings

TRUE_VALUES = ("true", "1", "yes", "on")
FALSE_VALUES = ("false", "0", "no", "off")


def _settings_with(raw: str | None) -> Settings:
    """Dựng Settings với AI_FEATURES_ENABLED đặt qua biến môi trường.

    `_env_file=None` để không đọc backend/.env của máy dev, giữ test tất định.
    """
    previous = os.environ.get("AI_FEATURES_ENABLED")
    if raw is None:
        os.environ.pop("AI_FEATURES_ENABLED", None)
    else:
        os.environ["AI_FEATURES_ENABLED"] = raw
    try:
        return Settings(_env_file=None)
    finally:
        if previous is None:
            os.environ.pop("AI_FEATURES_ENABLED", None)
        else:
            os.environ["AI_FEATURES_ENABLED"] = previous


def test_default_is_false_when_variable_absent():
    assert _settings_with(None).ai_features_enabled is False


@pytest.mark.parametrize("raw", TRUE_VALUES + tuple(v.upper() for v in TRUE_VALUES) + ("  YeS  ",))
def test_truthy_values(raw):
    assert _settings_with(raw).ai_features_enabled is True


@pytest.mark.parametrize("raw", FALSE_VALUES + tuple(v.upper() for v in FALSE_VALUES) + ("  Off ",))
def test_falsy_values(raw):
    assert _settings_with(raw).ai_features_enabled is False


@pytest.mark.parametrize("raw", ["", "   ", "\t"])
def test_blank_is_false_not_an_error(raw):
    """Pydantic mặc định coi chuỗi rỗng là lỗi validate; đây là lý do cần validator."""
    assert _settings_with(raw).ai_features_enabled is False


@pytest.mark.parametrize("raw", ["maybe", "tru", "2", "-1", "bật", "null"])
def test_invalid_value_fails_loudly_with_variable_name(raw):
    with pytest.raises(ValidationError) as excinfo:
        _settings_with(raw)
    message = str(excinfo.value)
    assert "AI_FEATURES_ENABLED" in message
    for expected in ("true", "false"):
        assert expected in message


def test_get_settings_is_cached_per_process():
    get_settings.cache_clear()
    try:
        assert get_settings() is get_settings()
    finally:
        get_settings.cache_clear()


# --- Property 1 -------------------------------------------------------------
# Parse cờ là total function trên miền input: mọi chuỗi hoặc cho ra bool, hoặc raise
# ValidationError nêu tên biến. Không input nào rơi vào nhánh âm thầm dùng default.


@hypothesis_settings(max_examples=200, deadline=None)
@given(
    st.one_of(
        # Ký tự null bị os.environ từ chối ở tầng OS nên biến môi trường thật không bao
        # giờ mang giá trị đó; loại khỏi miền sinh để test đúng phạm vi validator.
        st.text(alphabet=st.characters(blacklist_characters="\x00")),
        st.sampled_from(TRUE_VALUES + FALSE_VALUES),
        st.sampled_from(TRUE_VALUES + FALSE_VALUES).map(lambda v: f"  {v.upper()}  "),
    )
)
def test_property_flag_parsing_is_total(raw):
    normalized = raw.strip().lower()
    try:
        value = _settings_with(raw).ai_features_enabled
    except ValidationError as exc:
        assert normalized not in TRUE_VALUES
        assert normalized not in FALSE_VALUES
        assert normalized != ""
        assert "AI_FEATURES_ENABLED" in str(exc)
        return

    assert isinstance(value, bool)
    if normalized in TRUE_VALUES:
        assert value is True
    elif normalized in FALSE_VALUES or normalized == "":
        assert value is False
    else:
        raise AssertionError(f"Giá trị không hợp lệ {raw!r} lẽ ra phải raise ValidationError")
