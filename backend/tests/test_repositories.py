from app.db.repositories.chunk_repo import vector_literal


def test_vector_literal_is_pgvector_compatible():
    assert vector_literal([0, 0.5, -1]) == "[0.00000000,0.50000000,-1.00000000]"
