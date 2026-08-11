"""Task 5.5 — readiness theo chế độ. Gồm Property 6 (đơn điệu của readiness)."""

import asyncio
import itertools
from types import SimpleNamespace

from hypothesis import given, strategies as st

from app.services.readiness import ReadinessSnapshot, evaluate_readiness
from tests.fakes import FakePool, FakeStorage


def _snapshot(db, sc, sr, dc, ec, *, ai_enabled):
    return ReadinessSnapshot(
        database=db,
        storage_configured=sc,
        storage_reachable=sr,
        dify_configured=dc,
        embedding_configured=ec,
        ai_enabled=ai_enabled,
    )


def test_disabled_mode_ready_ignores_dify_and_embedding():
    for dc, ec in itertools.product([True, False], repeat=2):
        snapshot = _snapshot(True, True, True, dc, ec, ai_enabled=False)
        assert snapshot.ready is True


def test_enabled_mode_requires_all_five_checks():
    assert _snapshot(True, True, True, True, True, ai_enabled=True).ready is True
    assert _snapshot(True, True, True, False, True, ai_enabled=True).ready is False
    assert _snapshot(True, True, True, True, False, ai_enabled=True).ready is False


def test_core_checks_still_gate_disabled_mode():
    assert _snapshot(False, True, True, False, False, ai_enabled=False).ready is False
    assert _snapshot(True, False, True, False, False, ai_enabled=False).ready is False
    assert _snapshot(True, True, False, False, False, ai_enabled=False).ready is False


async def test_evaluate_readiness_tolerates_none_ai_services():
    """Ở AI_Disabled_Mode dify/embedding là None; probe không được raise AttributeError."""
    state = SimpleNamespace(
        pool=FakePool(),
        storage=FakeStorage(),
        dify=None,
        embedding=None,
        ai_enabled=False,
    )
    snapshot = await evaluate_readiness(state)
    assert snapshot.dify_configured is False
    assert snapshot.embedding_configured is False
    assert snapshot.ai_enabled is False
    assert snapshot.database is True
    assert snapshot.ready is True


async def test_evaluate_readiness_reports_missing_pool():
    state = SimpleNamespace(pool=None, storage=FakeStorage(), dify=None, embedding=None, ai_enabled=False)
    snapshot = await evaluate_readiness(state)
    assert snapshot.database is False
    assert snapshot.ready is False


async def test_evaluate_readiness_skips_reachability_when_not_configured():
    state = SimpleNamespace(
        pool=FakePool(),
        storage=FakeStorage(configured=False),
        dify=None,
        embedding=None,
        ai_enabled=False,
    )
    snapshot = await evaluate_readiness(state)
    assert snapshot.storage_configured is False
    assert snapshot.storage_reachable is False
    assert snapshot.ready is False


# --- Property 6 -------------------------------------------------------------
# Ở chế độ tắt, `ready` chỉ phụ thuộc database + storage; bật AI chỉ có thể khắt khe hơn.
# Đây là chốt hồi quy cho hazard `all(checks.model_dump().values())` đã bị loại bỏ.


@given(
    st.booleans(),
    st.booleans(),
    st.booleans(),
    st.booleans(),
    st.booleans(),
)
def test_property_readiness_monotonicity(db, sc, sr, dc, ec):
    core = db and sc and sr
    snap_off = _snapshot(db, sc, sr, dc, ec, ai_enabled=False)
    snap_on = _snapshot(db, sc, sr, dc, ec, ai_enabled=True)

    assert snap_off.ready == core
    assert snap_on.ready == (core and dc and ec)
    # Bật AI chỉ có thể làm điều kiện khắt khe hơn, không bao giờ lỏng hơn.
    assert not (snap_on.ready and not snap_off.ready)
    assert snap_off.ai_enabled is False
    assert snap_on.ai_enabled is True


@given(st.booleans(), st.booleans(), st.booleans())
def test_property_disabled_ready_independent_of_ai_checks(db, sc, sr):
    """Với mọi cặp (dify, embedding), `ready` ở chế độ tắt không đổi."""
    values = {
        _snapshot(db, sc, sr, dc, ec, ai_enabled=False).ready
        for dc, ec in itertools.product([True, False], repeat=2)
    }
    assert len(values) == 1


def test_property_6_also_holds_through_evaluate_readiness():
    """Kiểm chứng qua đường thật, không chỉ trên dataclass."""

    async def run(ai_enabled: bool) -> bool:
        state = SimpleNamespace(
            pool=FakePool(),
            storage=FakeStorage(),
            dify=SimpleNamespace(configured=False),
            embedding=SimpleNamespace(configured=False),
            ai_enabled=ai_enabled,
        )
        return (await evaluate_readiness(state)).ready

    assert asyncio.run(run(False)) is True
    assert asyncio.run(run(True)) is False
