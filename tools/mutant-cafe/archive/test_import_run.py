import json
import unittest
from import_run import import_run


class ImportRunTests(unittest.TestCase):
    def setUp(self):
        self.commit = "a" * 40
        self.result = {"mutant": {"id": "1" * 24, "file": "/work/src/chart.ts",
                                 "functionName": "chart", "genre": "FnValue",
                                 "span": {"start": {"line": 3}}},
                       "outcome": "untested", "output": "runner details"}

    def report(self):
        return json.dumps({"schemaVersion": 2, "root": "/work", "results": [self.result]}).encode()

    def test_retries_and_later_observations(self):
        archive = import_run([], self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z")
        self.assertEqual(archive, import_run(archive, self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z"))
        self.assertNotIn("runner details", str(archive))
        self.assertEqual(archive[0]["entries"][0]["file"], "src/chart.ts")
        self.result["outcome"] = "caught"
        with self.assertRaises(ValueError):
            import_run(archive, self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z")
        updated = import_run(archive, self.report(), 42, 2, self.commit, "2026-11-25T18:30:39Z")
        self.assertEqual([r["entries"][0]["outcome"] for r in updated], ["untested", "caught"])

    def test_rejects_paths_outside_web_source(self):
        self.result["mutant"]["file"] = "/work/src/../../outside.ts"
        with self.assertRaises(ValueError):
            import_run([], self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z")
