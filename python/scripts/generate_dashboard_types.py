from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = PACKAGE_ROOT.parent
CONTRACT_ROOT = REPOSITORY_ROOT / "contracts" / "dashboard-v1"
OUTPUT_ROOT = PACKAGE_ROOT / "gluondb" / "generated"


def normalize_for_typing(value: object) -> object:
    """Remove validation-only scalar intersections code generators mis-type."""
    if isinstance(value, list):
        return [normalize_for_typing(item) for item in value]
    if not isinstance(value, dict):
        return value

    normalized = {key: normalize_for_typing(item) for key, item in value.items()}
    if normalized.get("type") == "string" and isinstance(normalized.get("allOf"), list):
        # JSON Schema uses this to intersect two regexes. The Python model is a
        # string either way; the server remains responsible for both patterns.
        normalized.pop("allOf")
    return normalized


def operation_put_schema(schema: dict[str, object]) -> dict[str, object]:
    body = dict(schema)
    body["title"] = "DashboardOperationPutBody"
    properties = dict(body.get("properties", {}))
    properties.pop("key", None)
    body["properties"] = properties
    body["required"] = [
        name for name in body.get("required", []) if isinstance(name, str) and name != "key"
    ]
    return body


def generate_module(
    schema: dict[str, object], root_name: str, destination: Path, source_revision: str
) -> str:
    with tempfile.TemporaryDirectory() as directory:
        temporary = Path(directory)
        schema_path = temporary / "schema.json"
        output_path = temporary / "types.py"
        schema_path.write_text(json.dumps(schema), encoding="utf-8")
        subprocess.run(
            [
                sys.executable,
                "-m",
                "datamodel_code_generator",
                "--input",
                str(schema_path),
                "--input-file-type",
                "jsonschema",
                "--output",
                str(output_path),
                "--output-model-type",
                "typing.TypedDict",
                "--target-python-version",
                "3.10",
                "--disable-timestamp",
                "--use-standard-collections",
                "--enum-field-as-literal",
                "all",
                "--no-use-union-operator",
                "--no-use-closed-typed-dict",
                "--formatters",
                "builtin",
                "--import-overrides",
                '{"TypeAlias":"typing_extensions","TypedDict":"typing_extensions","NotRequired":"typing_extensions"}',
                "--class-name",
                root_name,
            ],
            check=True,
        )
        generated = output_path.read_text(encoding="utf-8")
    return (
        f"# Generated from gluonDB/gluondb_front@{source_revision}. Do not edit.\n"
        + generated
    )


def write_or_check(destination: Path, source: str, check: bool) -> bool:
    if check:
        current = destination.read_text(encoding="utf-8") if destination.exists() else ""
        if current != source:
            print(f"{destination.name} is stale. Run the dashboard type generator.")
            return False
        return True
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(source, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    lock = json.loads((CONTRACT_ROOT / "contract.lock.json").read_text(encoding="utf-8"))
    document = normalize_for_typing(
        json.loads((CONTRACT_ROOT / "document.schema.json").read_text(encoding="utf-8"))
    )
    operation = normalize_for_typing(
        json.loads((CONTRACT_ROOT / "operation.schema.json").read_text(encoding="utf-8"))
    )

    modules = [
        (
            document,
            "DashboardDocumentV1",
            OUTPUT_ROOT / "dashboard_document.py",
        ),
        (
            operation,
            "DashboardOperationDeclaration",
            OUTPUT_ROOT / "dashboard_operation.py",
        ),
        (
            operation_put_schema(operation),
            "DashboardOperationPutBody",
            OUTPUT_ROOT / "dashboard_operation_put.py",
        ),
    ]
    fresh = True
    for schema, root_name, destination in modules:
        source = generate_module(
            schema, root_name, destination, lock["source_revision"]
        )
        fresh = write_or_check(destination, source, args.check) and fresh
    return 0 if fresh else 1


if __name__ == "__main__":
    raise SystemExit(main())
