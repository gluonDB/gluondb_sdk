from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Column:
    name: str
    type: str


@dataclass
class QueryResult:
    """Result of a SQL query execution."""

    columns: List[Column]
    rows: List[List[Any]]
    row_count: int
    datasource_id: str
    execution_time_ms: int
    api_version: str

    def to_dataframe(self) -> Any:
        """Convert the result to a pandas DataFrame.

        Requires the ``pandas`` extra: ``pip install gluondb[pandas]``
        """
        try:
            import pandas as pd  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(
                "pandas is required for to_dataframe(). "
                "Install it with: pip install gluondb[pandas]"
            )
        col_names = [c.name for c in self.columns]
        return pd.DataFrame(self.rows, columns=col_names)


@dataclass
class Project:
    id: str
    name: str
    created_at: str


@dataclass
class Datasource:
    id: str
    name: str
    db_type: str
    created_at: str


@dataclass
class ApiMeta:
    api_version: str
    extra: Dict[str, Any] = field(default_factory=dict)
