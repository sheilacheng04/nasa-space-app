"""Catch missing runtime dependencies in Vercel's selected Python manifest."""
from pathlib import Path
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]


class VercelManifestTests(unittest.TestCase):
    def test_runtime_dependencies_match_the_local_install(self):
        manifest = tomllib.loads((ROOT / "pyproject.toml").read_text())
        requirements = {
            line.strip() for line in (ROOT / "requirements.txt").read_text().splitlines()
            if line.strip() and not line.startswith("#")
        }
        dependencies = set(manifest["project"]["dependencies"])
        self.assertTrue(any(item.startswith("fastapi==") for item in dependencies))
        self.assertEqual(requirements, dependencies)

    def test_runtime_and_entrypoint_are_explicit(self):
        manifest = tomllib.loads((ROOT / "pyproject.toml").read_text())
        self.assertEqual(manifest["project"]["requires-python"], ">=3.13,<3.14")
        self.assertEqual(manifest["tool"]["vercel"]["entrypoint"], "backend.main:app")
        self.assertTrue((ROOT / "backend/main.py").is_file())


if __name__ == "__main__":
    unittest.main()
